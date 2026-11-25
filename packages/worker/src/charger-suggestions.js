// Charger suggestions submitted by signed-in users, with a proof photo
// and one or more chargers (connector type, power in kW, quantity) at the
// location, scoped strictly to the submitting user and admins:
//
// - GET /api/charger-suggestions: lists the signed-in user's own suggestions
//   (filterable by ?status=pending|approved|rejected)
// - POST /api/charger-suggestions: submits a suggestion (signed in)
// - GET /api/charger-suggestions/{id}/photo: serves the proof photo only to
//   the user who submitted it or to an admin (private, no-store)
// - GET /api/admin/charger-suggestions: lists all suggestions (admin)
// - POST /api/admin/charger-suggestions/{id}/approve: approves and upserts
//   into `chargers` and `chargers_rtree` (admin)
// - POST /api/admin/charger-suggestions/{id}/reject: rejects (admin)

import { Buffer } from "node:buffer";
import { isAdmin } from "./admin-area.js";
import { upsertChargers } from "./db.js";

const SUGGESTIONS_PATH = "/api/charger-suggestions";
const SUGGESTION_PHOTO_PATH = /^\/api\/charger-suggestions\/(\d+)\/photo$/;
const ADMIN_SUGGESTIONS_PATH = "/api/admin/charger-suggestions";
const ADMIN_SUGGESTION_ACTION_PATH = /^\/api\/admin\/charger-suggestions\/(\d+)\/(approve|reject)$/;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_PHOTOS = 5;
const MAX_CONNECTORS = 20;
const PHOTO_PATTERN = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
const CONNECTOR_TYPES = [
  "ccs2",
  "ccs1",
  "chademo",
  "type2",
  "type1",
  "tesla-supercharger",
  "tesla-destination",
  "nacs",
  "schuko",
];
const STATUSES = ["pending", "approved", "rejected"];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });

const isText = (value, max, min = 0) =>
  typeof value === "string" && value.trim().length >= min && value.length <= max;

const isLocation = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const validConnector = (connector) =>
  typeof connector === "object" &&
  connector !== null &&
  CONNECTOR_TYPES.includes(connector.type) &&
  Number.isFinite(connector.powerKw) &&
  connector.powerKw > 0 &&
  connector.powerKw <= 1000 &&
  Number.isInteger(connector.quantity) &&
  connector.quantity >= 1 &&
  connector.quantity <= 100;

const isValidPhotoDataUrl = (value) => {
  if (typeof value !== "string") {
    return false;
  }
  const match = value.match(PHOTO_PATTERN);
  if (!match) {
    return false;
  }
  const base64 = match[2];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((base64.length * 3) / 4) - padding;
  return decodedBytes > 0 && decodedBytes <= MAX_PHOTO_BYTES;
};

const photosOf = (payload) => {
  if (Array.isArray(payload?.photos)) {
    return payload.photos;
  }
  if (typeof payload?.photo === "string") {
    return [payload.photo];
  }
  return [];
};

const validSuggestion = (payload) => {
  const photos = photosOf(payload);
  return (
    typeof payload === "object" &&
    payload !== null &&
    isText(payload.name, 200, 1) &&
    (payload.address === undefined || payload.address === null || isText(payload.address, 300)) &&
    (payload.operator === undefined ||
      payload.operator === null ||
      isText(payload.operator, 200)) &&
    isLocation(payload.location?.lat, payload.location?.lng) &&
    Array.isArray(payload.connectors) &&
    payload.connectors.length >= 1 &&
    payload.connectors.length <= MAX_CONNECTORS &&
    payload.connectors.every(validConnector) &&
    photos.length >= 1 &&
    photos.length <= MAX_PHOTOS &&
    photos.every(isValidPhotoDataUrl)
  );
};

const toClientSuggestion = (row, { includeUser = false } = {}) => {
  const photos = row.photos ? JSON.parse(row.photos) : row.photo ? [row.photo] : [];
  const photoUrls = photos.map(
    (_, index) => `/api/charger-suggestions/${row.id}/photo?index=${index}`
  );
  return {
    id: row.id,
    ...(includeUser ? { userEmail: row.user_email ?? null } : {}),
    name: row.name,
    address: row.address ?? "",
    operator: row.operator ?? "",
    location: { lat: row.lat, lng: row.lng },
    connectors: JSON.parse(row.connectors || "[]"),
    photoUrl: photoUrls[0] ?? `/api/charger-suggestions/${row.id}/photo`,
    photoUrls,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? null,
  };
};

const submitSuggestion = async (request, env, userId, user) => {
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
  if (!validSuggestion(payload)) {
    return json({ error: "Invalid suggestion" }, 400);
  }
  const connectors = payload.connectors.map(({ type, powerKw, quantity }) => ({
    type,
    powerKw,
    quantity,
  }));
  const photos = photosOf(payload);
  const createdAt = Date.now();
  await env.DB.prepare(
    `INSERT INTO charger_suggestions
       (user_id, user_email, name, address, operator, lat, lng, connectors, photo, photos, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  )
    .bind(
      userId,
      user?.email ?? null,
      payload.name.trim(),
      payload.address?.trim() || null,
      payload.operator?.trim() || null,
      payload.location.lat,
      payload.location.lng,
      JSON.stringify(connectors),
      photos[0],
      JSON.stringify(photos),
      createdAt
    )
    .run();
  return json({ submitted: true }, 201);
};

// Lists only the signed-in user's own suggestions, without the photo payload.
const listUserSuggestions = async (db, userId, url) => {
  const status = url.searchParams.get("status") || "";
  const columns =
    "id, name, address, operator, lat, lng, connectors, photos, status, created_at, reviewed_at";
  const query = STATUSES.includes(status)
    ? db
        .prepare(
          `SELECT ${columns} FROM charger_suggestions
           WHERE user_id = ? AND status = ? ORDER BY created_at DESC`
        )
        .bind(userId, status)
    : db
        .prepare(
          `SELECT ${columns} FROM charger_suggestions
           WHERE user_id = ? ORDER BY created_at DESC`
        )
        .bind(userId);
  const { results } = await query.all();
  return { suggestions: results.map((row) => toClientSuggestion(row)) };
};

// Serves a suggestion's proof photo only to its author or an admin.
const photoResponse = async (db, env, id, url, userId, user) => {
  const row = await db
    .prepare("SELECT user_id, photo, photos FROM charger_suggestions WHERE id = ?")
    .bind(id)
    .first();
  if (!row || (row.user_id !== userId && !isAdmin(env, user))) {
    return json({ error: "Not found" }, 404);
  }
  const photos = row.photos ? JSON.parse(row.photos) : row.photo ? [row.photo] : [];
  const index = Math.max(0, Number.parseInt(url.searchParams.get("index") ?? "0", 10) || 0);
  const match = photos[index]?.match(PHOTO_PATTERN);
  if (!match) {
    return json({ error: "Not found" }, 404);
  }
  const [, contentType, base64] = match;
  return new Response(Buffer.from(base64, "base64"), {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow, noimageindex",
    },
  });
};

const listAdminSuggestions = async (db, url) => {
  const status = url.searchParams.get("status") || "";
  const columns =
    "id, user_email, name, address, operator, lat, lng, connectors, photos, status, created_at, reviewed_at";
  const query = STATUSES.includes(status)
    ? db
        .prepare(
          `SELECT ${columns} FROM charger_suggestions WHERE status = ? ORDER BY created_at DESC`
        )
        .bind(status)
    : db.prepare(`SELECT ${columns} FROM charger_suggestions ORDER BY created_at DESC`);
  const { results } = await query.all();
  return {
    suggestions: results.map((row) => toClientSuggestion(row, { includeUser: true })),
  };
};

const reviewSuggestion = async (db, id, action) => {
  const row = await db.prepare("SELECT * FROM charger_suggestions WHERE id = ?").bind(id).first();
  if (!row) {
    return json({ error: "Suggestion not found" }, 404);
  }
  if (row.status !== "pending") {
    return json({ error: "Suggestion already reviewed" }, 409);
  }
  const now = Date.now();
  const nextStatus = action === "approve" ? "approved" : "rejected";
  if (action === "approve") {
    const connectors = JSON.parse(row.connectors || "[]");
    const numberOfPoints = connectors.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const maxPowerKw = connectors.reduce((max, item) => Math.max(max, item.powerKw || 0), 0);
    await upsertChargers(
      db,
      [
        {
          source: "community",
          sourceId: String(row.id),
          name: row.name,
          lat: row.lat,
          lng: row.lng,
          address: row.address ?? null,
          operator: row.operator ?? null,
          usageType: "Public",
          status: "Operational",
          numberOfPoints,
          maxPowerKw,
          connectors,
        },
      ],
      now
    );
  }
  await db
    .prepare("UPDATE charger_suggestions SET status = ?, reviewed_at = ? WHERE id = ?")
    .bind(nextStatus, now, id)
    .run();
  return json({ id, status: nextStatus });
};

const suggestionsResponse = async (request, env, userId, user, url = new URL(request.url)) => {
  const photoMatch = url.pathname.match(SUGGESTION_PHOTO_PATH);
  if (photoMatch) {
    return request.method === "GET"
      ? photoResponse(env.DB, env, Number(photoMatch[1]), url, userId, user)
      : json({ error: "Method not allowed" }, 405);
  }
  if (request.method === "GET") {
    return json(await listUserSuggestions(env.DB, userId, url));
  }
  if (request.method === "POST") {
    return submitSuggestion(request, env, userId, user);
  }
  return json({ error: "Method not allowed" }, 405);
};

const adminSuggestionsResponse = async (request, env, url = new URL(request.url)) => {
  if (url.pathname === ADMIN_SUGGESTIONS_PATH) {
    return request.method === "GET"
      ? json(await listAdminSuggestions(env.DB, url))
      : json({ error: "Method not allowed" }, 405);
  }
  const match = url.pathname.match(ADMIN_SUGGESTION_ACTION_PATH);
  if (match && request.method === "POST") {
    return reviewSuggestion(env.DB, Number(match[1]), match[2]);
  }
  return json({ error: "Method not allowed" }, 405);
};

const routes = [
  {
    name: "charger-suggestions",
    limiter: "FAVORITES_LIMITER",
    signedIn: true,
    matches: (request, url) =>
      url.pathname === SUGGESTIONS_PATH || SUGGESTION_PHOTO_PATH.test(url.pathname),
    handle: ({ request, env, url, userId, user }) =>
      suggestionsResponse(request, env, userId, user, url),
  },
  {
    name: "admin-charger-suggestions",
    limiter: "ADMIN_LIMITER",
    signedIn: true,
    admin: true,
    matches: (request, url) =>
      url.pathname === ADMIN_SUGGESTIONS_PATH || ADMIN_SUGGESTION_ACTION_PATH.test(url.pathname),
    handle: ({ request, env, url }) => adminSuggestionsResponse(request, env, url),
  },
];

export {
  ADMIN_SUGGESTIONS_PATH,
  SUGGESTIONS_PATH,
  adminSuggestionsResponse,
  routes,
  suggestionsResponse,
  validSuggestion,
};
