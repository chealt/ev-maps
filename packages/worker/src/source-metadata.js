// Lookup data importers keep between runs (the source_metadata table), as JSON.

const saveSourceMetadata = (db, source, key, value) =>
  db
    .prepare(
      `INSERT INTO source_metadata (source, key, value, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (source, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(source, key, JSON.stringify(value), Date.now())
    .run();

const loadSourceMetadata = async (db, source, key) => {
  const row = await db
    .prepare("SELECT value FROM source_metadata WHERE source = ? AND key = ?")
    .bind(source, key)
    .first();
  return row ? JSON.parse(row.value) : null;
};

export { loadSourceMetadata, saveSourceMetadata };
