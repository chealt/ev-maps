// The chargers a signed-in user saved as favorites:
//
// - GET /api/favorites: { favorites: [{ charger, addedAt }] }, newest first
// - PUT /api/favorites/{id}: saves one, with { charger, addedAt }
// - DELETE /api/favorites/{id}: removes one
//
// Each favorite keeps a copy of the charger as the page had it (name,
// address, location...), so the list shows without the chargers' tiles.

import { countEvent } from "./admin-area.js";

const FAVORITES_PATH = "/api/favorites";
const FAVORITE_PATH = /^\/api\/favorites\/([^/]+)$/;
const MAX_FAVORITES = 500;
const MAX_BODY_BYTES = 16 * 1024;
const ID_PATTERN = /^[a-z]+:[\w.:-]{1,120}$/i;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const isFavoritesPath = (pathname) => pathname === FAVORITES_PATH || FAVORITE_PATH.test(pathname);

const isText = (value, max) => typeof value === "string" && value.length <= max;

// The charger, if it's in the shape the page sends for the given ID.
const validCharger = (charger, id) =>
  typeof charger === "object" &&
  charger !== null &&
  charger.id === id &&
  Number.isFinite(charger.location?.lat) &&
  Number.isFinite(charger.location?.lng) &&
  Math.abs(charger.location.lat) <= 90 &&
  Math.abs(charger.location.lng) <= 180 &&
  (charger.name === undefined || charger.name === null || isText(charger.name, 300)) &&
  (charger.address === undefined || charger.address === null || isText(charger.address, 500));

const listFavorites = async (db, userId) => {
  const { results } = await db
    .prepare("SELECT charger, added_at FROM favorites WHERE user_id = ? ORDER BY added_at DESC")
    .bind(userId)
    .all();
  return results.map((row) => ({ charger: JSON.parse(row.charger), addedAt: row.added_at }));
};

const saveFavorite = async (request, env, userId, id) => {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return json({ error: "Too large" }, 413);
  }
  let favorite;
  try {
    favorite = JSON.parse(body);
  } catch {
    return json({ error: "Not JSON" }, 400);
  }
  if (!validCharger(favorite?.charger, id) || !Number.isFinite(favorite.addedAt)) {
    return json({ error: "Invalid favorite" }, 400);
  }
  const { count } = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM favorites WHERE user_id = ? AND charger_id != ?"
  )
    .bind(userId, id)
    .first();
  if (count >= MAX_FAVORITES) {
    return json({ error: `At most ${MAX_FAVORITES} favorites` }, 409);
  }
  await env.DB.prepare(
    `INSERT INTO favorites (user_id, charger_id, charger, added_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, charger_id) DO UPDATE SET charger = excluded.charger`
  )
    .bind(userId, id, JSON.stringify(favorite.charger), favorite.addedAt)
    .run();
  return json({ saved: id });
};

const favoritesResponse = async (request, env, userId) => {
  const { pathname } = new URL(request.url);
  if (pathname === FAVORITES_PATH) {
    return request.method === "GET"
      ? json({ favorites: await listFavorites(env.DB, userId) })
      : json({ error: "Method not allowed" }, 405);
  }
  const id = decodeURIComponent(pathname.match(FAVORITE_PATH)[1]);
  if (!ID_PATTERN.test(id)) {
    return json({ error: "Invalid charger ID" }, 400);
  }
  if (request.method === "PUT") {
    return saveFavorite(request, env, userId, id);
  }
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM favorites WHERE user_id = ? AND charger_id = ?")
      .bind(userId, id)
      .run();
    return json({ removed: id });
  }
  return json({ error: "Method not allowed" }, 405);
};

const routes = [
  {
    name: "favorites",
    limiter: "FAVORITES_LIMITER",
    signedIn: true,
    matches: (request, url) => isFavoritesPath(url.pathname),
    handle: async ({ request, env, context, userId }) => {
      const response = await favoritesResponse(request, env, userId);
      if (request.method === "PUT" && response.ok) {
        context.waitUntil(countEvent(env, "favorite_added"));
      }
      return response;
    },
  },
];

export { favoritesResponse, isFavoritesPath, routes, validCharger };
