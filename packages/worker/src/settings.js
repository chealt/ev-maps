// Settings saved to a signed-in user's account: GET /api/settings reads
// them, PUT /api/settings saves some. They're sections (e.g. `filters`), each
// with `updatedAt`, the time the user changed it: a saved section replaces
// the account's only if it's newer, so devices can't undo each other's newer
// changes.

const SETTINGS_PATH = "/api/settings";
const MAX_BODY_BYTES = 32 * 1024;
// Sections and what's allowed in them.
const SECTIONS = {
  filters: {
    powerRanges: (value) => isStringList(value, 10),
    connectorTypes: (value) => isStringList(value, 20),
    // Operator names as the charger data has them; "" is "unknown operator".
    excludedOperators: (value) => isStringList(value, 200, 120),
    onlyFavorites: (value) => typeof value === "boolean",
  },
};

const isStringList = (value, max, maxLength = 40) =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((item) => typeof item === "string" && item.length <= maxLength);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// The section, if it's a known one in the right shape.
const validSection = (name, section) => {
  const fields = SECTIONS[name];
  if (!fields || typeof section !== "object" || section === null) {
    return false;
  }
  if (!Number.isFinite(section.updatedAt)) {
    return false;
  }
  return Object.entries(section).every(
    ([field, value]) => field === "updatedAt" || fields[field]?.(value)
  );
};

// The account's settings with `changes` applied: each changed section that's
// newer than the account's.
const mergeSettings = (stored, changes) => {
  const merged = { ...stored };
  for (const [name, section] of Object.entries(changes)) {
    if (!(stored[name]?.updatedAt >= section.updatedAt)) {
      merged[name] = section;
    }
  }
  return merged;
};

const readSettings = async (db, userId) => {
  const row = await db
    .prepare("SELECT data FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first();
  return row ? JSON.parse(row.data) : {};
};

const settingsResponse = async (request, env, userId) => {
  if (request.method === "GET") {
    return json({ settings: await readSettings(env.DB, userId) });
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return json({ error: "Too large" }, 413);
  }
  let changes;
  try {
    changes = JSON.parse(body);
  } catch {
    return json({ error: "Not JSON" }, 400);
  }
  if (
    typeof changes !== "object" ||
    changes === null ||
    !Object.entries(changes).every(([name, section]) => validSection(name, section))
  ) {
    return json({ error: "Unknown or invalid settings" }, 400);
  }
  const settings = mergeSettings(await readSettings(env.DB, userId), changes);
  await env.DB.prepare(
    `INSERT INTO user_settings (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  )
    .bind(userId, JSON.stringify(settings), Date.now())
    .run();
  return json({ settings });
};

export { SETTINGS_PATH, mergeSettings, settingsResponse, validSection };
