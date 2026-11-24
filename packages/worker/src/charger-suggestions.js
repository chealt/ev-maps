// Charger suggestions submitted by signed-in users, with a proof photo
// and one or more chargers (connector type, power in kW, quantity) at the
// location, and the admin endpoints to review them and add approved ones to
// the `chargers` database:
//
// - POST /api/charger-suggestions: submits a suggestion (signed in)
// - GET /api/admin/charger-suggestions: lists suggestions (admin)
// - POST /api/admin/charger-suggestions/{id}/approve: approves and upserts
//   into `chargers` and `chargers_rtree` (admin)
// - POST /api/admin/charger-suggestions/{id}/reject: rejects (admin)

import { upsertChargers } from "./db.js";

const SUGGESTIONS_PATH = "/api/charger-suggestions";
const ADMIN_SUGGESTIONS_PATH = "/api/admin/charger-suggestions";
const ADMIN_SUGGESTION_ACTION_PATH = /^\/api\/admin\/charger-suggestions\/(\d+)\/(approve|reject)$/;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_CONNECTORS = 20;
const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;
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
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
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

const validSuggestion = (payload) =>
  typeof payload === "object" &&
  payload !== null &&
  isText(payload.name, 200, 1) &&
  (payload.address === undefined || payload.address === null || isText(payload.address, 300)) &&
  (payload.operator === undefined || payload.operator === null || isText(payload.operator, 200)) &&
  isLocation(payload.location?.lat, payload.location?.lng) &&
  Array.isArray(payload.connectors) &&
  payload.connectors.length >= 1 &&
  payload.connectors.length <= MAX_CONNECTORS &&
  payload.connectors.every(validConnector) &&
  typeof payload.photo === "string" &&
  payload.photo.length <= 750 * 1024 &&
  PHOTO_PATTERN.test(payload.photo);

const toClientSuggestion = (row) => ({
  id: row.id,
  userEmail: row.user_email ?? null,
  name: row.name,
  address: row.address ?? "",
  operator: row.operator ?? "",
  location: { lat: row.lat, lng: row.lng },
  connectors: JSON.parse(row.connectors || "[]"),
  photo: row.photo,
  status: row.status,
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at ?? null,
});

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
  const createdAt = Date.now();
  await env.DB.prepare(
    `INSERT INTO charger_suggestions
       (user_id, user_email, name, address, operator, lat, lng, connectors, photo, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
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
      payload.photo,
      createdAt
    )
    .run();
  return json({ submitted: true }, 201);
};

const listSuggestions = async (db, url) => {
  const status = url.searchParams.get("status") || "";
  const query = STATUSES.includes(status)
    ? db
        .prepare("SELECT * FROM charger_suggestions WHERE status = ? ORDER BY created_at DESC")
        .bind(status)
    : db.prepare("SELECT * FROM charger_suggestions ORDER BY created_at DESC");
  const { results } = await query.all();
  return { suggestions: results.map(toClientSuggestion) };
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

const suggestionsResponse = async (request, env, userId, user) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  return submitSuggestion(request, env, userId, user);
};

const adminSuggestionsResponse = async (request, env, url) => {
  if (url.pathname === ADMIN_SUGGESTIONS_PATH) {
    return request.method === "GET"
      ? json(await listSuggestions(env.DB, url))
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
    matches: (request, url) => url.pathname === SUGGESTIONS_PATH,
    handle: ({ request, env, userId, user }) => suggestionsResponse(request, env, userId, user),
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
