// Chargers flagged as unavailable by signed-in users, optionally with one
// photo of it as proof (#371). A user has one open flag per charger: a
// second replaces the first (keeping its photo unless there's a new one),
// so the admins' list, grouped by charger, counts people. Confirming a
// charger's flags marks it temporarily unavailable, as a community value
// (src/charger-reports.js); dismissing them closes them.
//
// - POST /api/charger-unavailability: flags a charger (signed in)
// - GET /api/charger-unavailability/{id}/photo: a flag's photo, only for its
//   author or an admin (private, no-store)
// - GET /api/admin/charger-unavailability: the chargers with open flags,
//   most reporters first, then most photos (admin)
// - POST /api/admin/charger-unavailability/{chargerId}/confirm|dismiss: acts
//   on all of a charger's open flags (admin)

import { Buffer } from "node:buffer";
import { isAdmin } from "./admin-area.js";
import { PHOTO_PATTERN, isPhoto } from "./charger-proof.js";
import { setCommunityValues } from "./charger-reports.js";
import { statusId } from "./charger-values.js";

const FLAGS_PATH = "/api/charger-unavailability";
const FLAG_PHOTO_PATH = /^\/api\/charger-unavailability\/(\d+)\/photo$/;
const ADMIN_FLAGS_PATH = "/api/admin/charger-unavailability";
const ADMIN_FLAG_ACTION_PATH = /^\/api\/admin\/charger-unavailability\/([^/]+)\/(confirm|dismiss)$/;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
// As a report's photos (src/charger-reports.js): a row's size in D1.
const MAX_PHOTO_BYTES = 1400 * 1024;
const MAX_CHARGERS = 200;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });

const validFlag = (payload) =>
  typeof payload === "object" &&
  payload !== null &&
  typeof payload.chargerId === "string" &&
  /^[^:]+:.+$/.test(payload.chargerId) &&
  payload.chargerId.length <= 200 &&
  (payload.photo === undefined ||
    payload.photo === null ||
    isPhoto(payload.photo, MAX_PHOTO_BYTES));

const splitChargerId = (chargerId) => {
  const colon = chargerId.indexOf(":");
  return [chargerId.slice(0, colon), chargerId.slice(colon + 1)];
};

const submitFlag = async (request, env, userId, user, now = Date.now()) => {
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
  if (!validFlag(payload)) {
    return json({ error: "Invalid flag" }, 400);
  }
  const [source, sourceId] = splitChargerId(payload.chargerId);
  const charger = await env.DB.prepare(
    "SELECT name FROM chargers WHERE source = ? AND source_id = ?"
  )
    .bind(source, sourceId)
    .first();
  if (!charger) {
    return json({ error: "Charger not found" }, 404);
  }
  const flag = await env.DB.prepare(
    `INSERT INTO charger_unavailability
       (user_id, user_email, charger_id, charger_name, photo, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)
     ON CONFLICT (charger_id, user_id) WHERE status = 'pending' DO UPDATE SET
       photo = COALESCE(excluded.photo, photo), created_at = excluded.created_at
     RETURNING id`
  )
    .bind(
      userId,
      user?.email ?? null,
      payload.chargerId,
      charger.name ?? null,
      payload.photo ?? null,
      now
    )
    .first();
  return json({ submitted: true, id: flag.id }, 201);
};

// Serves a flag's photo only to its author or an admin.
const photoResponse = async (env, id, userId, user) => {
  const row = await env.DB.prepare("SELECT user_id, photo FROM charger_unavailability WHERE id = ?")
    .bind(id)
    .first();
  const match = row?.photo?.match(PHOTO_PATTERN);
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

// The chargers with open flags: those more people flagged first, then those
// with more photos, then the most recently flagged; each with its flags,
// the ones with a photo first, without the photos' data.
const listAdminFlags = async (db) => {
  const { results } = await db
    .prepare(
      `SELECT f.id, f.user_email, f.charger_id, f.charger_name, f.created_at,
              f.photo IS NOT NULL AS has_photo, c.community_status, c.status AS source_status
       FROM charger_unavailability f
       LEFT JOIN chargers c
         ON c.source = substr(f.charger_id, 1, instr(f.charger_id, ':') - 1)
         AND c.source_id = substr(f.charger_id, instr(f.charger_id, ':') + 1)
       WHERE f.status = 'pending'
       ORDER BY has_photo DESC, f.created_at DESC, f.id DESC`
    )
    .all();
  const chargers = new Map();
  for (const row of results) {
    const charger = chargers.get(row.charger_id) ?? {
      chargerId: row.charger_id,
      chargerName: row.charger_name ?? "",
      currentStatus: row.community_status ?? statusId(row.source_status) ?? null,
      reporters: 0,
      withPhoto: 0,
      lastReportedAt: 0,
      flags: [],
    };
    charger.reporters += 1;
    charger.withPhoto += row.has_photo ? 1 : 0;
    charger.lastReportedAt = Math.max(charger.lastReportedAt, row.created_at);
    charger.flags.push({
      id: row.id,
      userEmail: row.user_email ?? null,
      createdAt: row.created_at,
      photoUrl: row.has_photo ? `${FLAGS_PATH}/${row.id}/photo` : null,
    });
    chargers.set(row.charger_id, charger);
  }
  return {
    chargers: [...chargers.values()]
      .toSorted(
        (a, b) =>
          b.reporters - a.reporters ||
          b.withPhoto - a.withPhoto ||
          b.lastReportedAt - a.lastReportedAt
      )
      .slice(0, MAX_CHARGERS),
  };
};

const reviewFlags = async (db, chargerId, action, now = Date.now()) => {
  const nextStatus = action === "confirm" ? "confirmed" : "dismissed";
  const { results } = await db
    .prepare(
      `UPDATE charger_unavailability SET status = ?, reviewed_at = ?
       WHERE charger_id = ? AND status = 'pending' RETURNING id`
    )
    .bind(nextStatus, now, chargerId)
    .all();
  if (!results.length) {
    return json({ error: "No open flags" }, 404);
  }
  if (action === "confirm") {
    await setCommunityValues(db, chargerId, { availability: "temporarily-unavailable" }, now);
  }
  return json({ chargerId, status: nextStatus, flags: results.length });
};

const flagsResponse = async (request, env, userId, user, url = new URL(request.url)) => {
  const photoMatch = url.pathname.match(FLAG_PHOTO_PATH);
  if (photoMatch) {
    return request.method === "GET"
      ? photoResponse(env, Number(photoMatch[1]), userId, user)
      : json({ error: "Method not allowed" }, 405);
  }
  return request.method === "POST"
    ? submitFlag(request, env, userId, user)
    : json({ error: "Method not allowed" }, 405);
};

const adminFlagsResponse = async (request, env, url = new URL(request.url)) => {
  if (url.pathname === ADMIN_FLAGS_PATH) {
    return request.method === "GET"
      ? json(await listAdminFlags(env.DB))
      : json({ error: "Method not allowed" }, 405);
  }
  const match = url.pathname.match(ADMIN_FLAG_ACTION_PATH);
  return match && request.method === "POST"
    ? reviewFlags(env.DB, decodeURIComponent(match[1]), match[2])
    : json({ error: "Method not allowed" }, 405);
};

const routes = [
  {
    name: "charger-unavailability",
    limiter: "FAVORITES_LIMITER",
    signedIn: true,
    matches: (request, url) => url.pathname === FLAGS_PATH || FLAG_PHOTO_PATH.test(url.pathname),
    handle: ({ request, env, url, userId, user }) => flagsResponse(request, env, userId, user, url),
  },
  {
    name: "admin-charger-unavailability",
    limiter: "ADMIN_LIMITER",
    signedIn: true,
    admin: true,
    matches: (request, url) =>
      url.pathname === ADMIN_FLAGS_PATH || ADMIN_FLAG_ACTION_PATH.test(url.pathname),
    handle: ({ request, env, url }) => adminFlagsResponse(request, env, url),
  },
];

export { adminFlagsResponse, flagsResponse, routes, validFlag };
