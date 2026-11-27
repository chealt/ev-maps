// Changes to a charger's availability or price, reported by signed-in users
// with proof (src/charger-proof.js): where their device was, from its GPS,
// a photo of the charger and, for a price, one of a receipt, an invoice or
// a charging app. Each gets a trust score (src/trust-score.js) for the
// admins who review it; an approved one sets the charger's community
// values, which imports don't touch and reads prefer (src/db.js).
//
// - POST /api/charger-reports: reports a change (signed in)
// - GET /api/charger-reports/{id}/photos/{position}: a report's photo, only
//   for its author or an admin (private, no-store)
// - GET /api/admin/charger-reports: lists the reports, newest first,
//   filterable by ?status=pending|approved|rejected (admin)
// - POST /api/admin/charger-reports/{id}/approve|reject (admin)

import { Buffer } from "node:buffer";
import { isAdmin } from "./admin-area.js";
import {
  PHOTO_PATTERN,
  cleanPrice,
  costText,
  isAvailability,
  isDeviceLocation,
  isPhoto,
  isPrice,
} from "./charger-proof.js";
import { statusId } from "./charger-values.js";
import { distanceMeters, trustInputs, trustScore } from "./trust-score.js";

const REPORTS_PATH = "/api/charger-reports";
const REPORT_PHOTO_PATH = /^\/api\/charger-reports\/(\d+)\/photos\/(\d+)$/;
const ADMIN_REPORTS_PATH = "/api/admin/charger-reports";
const ADMIN_REPORT_ACTION_PATH = /^\/api\/admin\/charger-reports\/(\d+)\/(approve|reject)$/;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
// Each photo is a row of its own, under D1's limit on a row's size once
// base64-encoded; the app scales photos down to fit.
const MAX_PHOTO_BYTES = 1400 * 1024;
const MAX_CHARGER_PHOTOS = 3;
const MAX_RECEIPT_PHOTOS = 2;
const STATUSES = ["pending", "approved", "rejected"];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });

const photoList = (value, min, max) =>
  Array.isArray(value) &&
  value.length >= min &&
  value.length <= max &&
  value.every((photo) => isPhoto(photo, MAX_PHOTO_BYTES));

// A report says the availability, the price, or both; a price needs a photo
// of what shows it.
const validReport = (payload) => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const hasAvailability = payload.availability !== undefined && payload.availability !== null;
  const hasPrice = payload.price !== undefined && payload.price !== null;
  return (
    typeof payload.chargerId === "string" &&
    /^[^:]+:.+$/.test(payload.chargerId) &&
    payload.chargerId.length <= 200 &&
    (hasAvailability || hasPrice) &&
    (!hasAvailability || isAvailability(payload.availability)) &&
    (!hasPrice || isPrice(payload.price)) &&
    isDeviceLocation(payload.deviceLocation) &&
    photoList(payload.chargerPhotos, 1, MAX_CHARGER_PHOTOS) &&
    photoList(payload.receiptPhotos ?? [], hasPrice ? 1 : 0, MAX_RECEIPT_PHOTOS)
  );
};

const splitChargerId = (chargerId) => {
  const colon = chargerId.indexOf(":");
  return [chargerId.slice(0, colon), chargerId.slice(colon + 1)];
};

const submitReport = async (request, env, userId, user, now = Date.now()) => {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return json({ error: "Too large" }, 413);
  }
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return json({ error: "Not JSON" }, 400);
  }
  if (!validReport(payload)) {
    return json({ error: "Invalid report" }, 400);
  }
  const [source, sourceId] = splitChargerId(payload.chargerId);
  const charger = await env.DB.prepare(
    "SELECT name, lat, lng FROM chargers WHERE source = ? AND source_id = ?"
  )
    .bind(source, sourceId)
    .first();
  if (!charger) {
    return json({ error: "Charger not found" }, 404);
  }
  const { deviceLocation } = payload;
  const receiptPhotos = payload.receiptPhotos ?? [];
  const distanceM = Math.round(distanceMeters(deviceLocation, charger));
  const { history, usage } = await trustInputs(env.DB, userId);
  const trust = trustScore(
    {
      distanceM,
      accuracyM: deviceLocation.accuracy,
      chargerPhotos: payload.chargerPhotos.length,
      receiptPhotos: receiptPhotos.length,
    },
    history,
    usage,
    now
  );
  const report = await env.DB.prepare(
    `INSERT INTO charger_reports
       (user_id, user_email, charger_id, charger_name, availability, price, device_lat,
        device_lng, device_accuracy, distance_m, trust_score, trust_factors, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?) RETURNING id`
  )
    .bind(
      userId,
      user?.email ?? null,
      payload.chargerId,
      charger.name ?? null,
      payload.availability ?? null,
      payload.price ? JSON.stringify(cleanPrice(payload.price)) : null,
      deviceLocation.lat,
      deviceLocation.lng,
      deviceLocation.accuracy ?? null,
      distanceM,
      trust.score,
      JSON.stringify(trust.factors),
      now
    )
    .first();
  const photos = [
    ...payload.chargerPhotos.map((data) => ({ kind: "charger", data })),
    ...receiptPhotos.map((data) => ({ kind: "receipt", data })),
  ];
  await env.DB.batch(
    photos.map(({ kind, data }, position) =>
      env.DB.prepare(
        "INSERT INTO charger_report_photos (report_id, position, kind, data) VALUES (?, ?, ?, ?)"
      ).bind(report.id, position, kind, data)
    )
  );
  return json({ submitted: true, id: report.id }, 201);
};

// Serves a report's photo only to its author or an admin.
const photoResponse = async (env, id, position, userId, user) => {
  const row = await env.DB.prepare(
    `SELECT r.user_id, p.data FROM charger_reports r
     JOIN charger_report_photos p ON p.report_id = r.id
     WHERE r.id = ? AND p.position = ?`
  )
    .bind(id, position)
    .first();
  const match = row?.data.match(PHOTO_PATTERN);
  if (!match || (row.user_id !== userId && !isAdmin(env, user))) {
    return json({ error: "Not found" }, 404);
  }
  const [, contentType, base64] = match;
  return new Response(Buffer.from(base64, "base64"), {
    headers: {
      "content-type": contentType,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow, noimageindex",
    },
  });
};

const toAdminReport = (row, photos) => ({
  id: row.id,
  userEmail: row.user_email ?? null,
  chargerId: row.charger_id,
  chargerName: row.charger_name ?? "",
  // A status ID, from the community's value or the source's words.
  currentStatus: row.community_status ?? statusId(row.source_status) ?? null,
  currentCost: row.current_cost ?? null,
  availability: row.availability ?? null,
  price: row.price ? JSON.parse(row.price) : null,
  deviceLocation: {
    lat: row.device_lat,
    lng: row.device_lng,
    accuracy: row.device_accuracy ?? null,
  },
  distanceM: row.distance_m ?? null,
  trustScore: row.trust_score,
  trustFactors: JSON.parse(row.trust_factors || "[]"),
  photos: photos.map(({ position, kind }) => ({
    kind,
    url: `${REPORTS_PATH}/${row.id}/photos/${position}`,
  })),
  status: row.status,
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at ?? null,
});

// The reports with what the charger says now (its community values, else
// its source's), so admins can compare; without the photos' data.
const listAdminReports = async (db, url) => {
  const status = url.searchParams.get("status") || "";
  const byStatus = STATUSES.includes(status);
  const reports = db.prepare(
    `SELECT r.*, c.community_status, c.status AS source_status,
            COALESCE(c.community_cost, c.usage_cost) AS current_cost
     FROM charger_reports r
     LEFT JOIN chargers c
       ON c.source = substr(r.charger_id, 1, instr(r.charger_id, ':') - 1)
       AND c.source_id = substr(r.charger_id, instr(r.charger_id, ':') + 1)
     ${byStatus ? "WHERE r.status = ?" : ""}
     ORDER BY r.created_at DESC, r.id DESC LIMIT 200`
  );
  const { results } = await (byStatus ? reports.bind(status) : reports).all();
  const { results: photos } = await db
    .prepare(
      `SELECT report_id, position, kind FROM charger_report_photos
       WHERE report_id IN (SELECT value FROM json_each(?)) ORDER BY position`
    )
    .bind(JSON.stringify(results.map((row) => row.id)))
    .all();
  return {
    reports: results.map((row) =>
      toAdminReport(
        row,
        photos.filter((photo) => photo.report_id === row.id)
      )
    ),
  };
};

// Sets a charger's community availability and price (each only when said).
const setCommunityValues = (db, chargerId, { availability, price }, now) => {
  const [source, sourceId] = splitChargerId(chargerId);
  return db
    .prepare(
      `UPDATE chargers SET community_status = COALESCE(?, community_status),
         community_cost = COALESCE(?, community_cost), community_updated_at = ?
       WHERE source = ? AND source_id = ?`
    )
    .bind(availability ?? null, price ? costText(price) : null, now, source, sourceId)
    .run();
};

const reviewReport = async (db, id, action, now = Date.now()) => {
  const row = await db.prepare("SELECT * FROM charger_reports WHERE id = ?").bind(id).first();
  if (!row) {
    return json({ error: "Report not found" }, 404);
  }
  if (row.status !== "pending") {
    return json({ error: "Report already reviewed" }, 409);
  }
  const nextStatus = action === "approve" ? "approved" : "rejected";
  if (action === "approve") {
    await setCommunityValues(
      db,
      row.charger_id,
      { availability: row.availability, price: row.price ? JSON.parse(row.price) : null },
      now
    );
  }
  await db
    .prepare("UPDATE charger_reports SET status = ?, reviewed_at = ? WHERE id = ?")
    .bind(nextStatus, now, id)
    .run();
  return json({ id, status: nextStatus });
};

const reportsResponse = async (request, env, userId, user, url = new URL(request.url)) => {
  const photoMatch = url.pathname.match(REPORT_PHOTO_PATH);
  if (photoMatch) {
    return request.method === "GET"
      ? photoResponse(env, Number(photoMatch[1]), Number(photoMatch[2]), userId, user)
      : json({ error: "Method not allowed" }, 405);
  }
  return request.method === "POST"
    ? submitReport(request, env, userId, user)
    : json({ error: "Method not allowed" }, 405);
};

const adminReportsResponse = async (request, env, url = new URL(request.url)) => {
  if (url.pathname === ADMIN_REPORTS_PATH) {
    return request.method === "GET"
      ? json(await listAdminReports(env.DB, url))
      : json({ error: "Method not allowed" }, 405);
  }
  const match = url.pathname.match(ADMIN_REPORT_ACTION_PATH);
  return match && request.method === "POST"
    ? reviewReport(env.DB, Number(match[1]), match[2])
    : json({ error: "Method not allowed" }, 405);
};

const routes = [
  {
    name: "charger-reports",
    limiter: "FAVORITES_LIMITER",
    signedIn: true,
    matches: (request, url) =>
      url.pathname === REPORTS_PATH || REPORT_PHOTO_PATH.test(url.pathname),
    handle: ({ request, env, url, userId, user }) =>
      reportsResponse(request, env, userId, user, url),
  },
  {
    name: "admin-charger-reports",
    limiter: "ADMIN_LIMITER",
    signedIn: true,
    admin: true,
    matches: (request, url) =>
      url.pathname === ADMIN_REPORTS_PATH || ADMIN_REPORT_ACTION_PATH.test(url.pathname),
    handle: ({ request, env, url }) => adminReportsResponse(request, env, url),
  },
];

export {
  adminReportsResponse,
  listAdminReports,
  reportsResponse,
  routes,
  setCommunityValues,
  submitReport,
  validReport,
};
