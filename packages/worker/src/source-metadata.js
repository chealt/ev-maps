// Lookup data importers keep between runs (the source_metadata table): an
// object of entries, stored as JSON in chunks, so a large one (France's
// 180,000 charging points) fits D1's 2 MB per value.

const ENTRIES_PER_CHUNK = 20000;
// D1 runs a batch in one round trip; keep batches modest.
const BATCH_SIZE = 25;

const saveSourceMetadata = async (db, source, key, value) => {
  const entries = Object.entries(value);
  const chunks = [];
  for (let index = 0; index < entries.length || chunks.length === 0; index += ENTRIES_PER_CHUNK) {
    chunks.push(Object.fromEntries(entries.slice(index, index + ENTRIES_PER_CHUNK)));
  }
  const now = Date.now();
  const statements = [
    ...chunks.map((chunk, number) =>
      db
        .prepare(
          `INSERT INTO source_metadata (source, key, chunk, value, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (source, key, chunk) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        )
        .bind(source, key, number, JSON.stringify(chunk), now)
    ),
    // Chunks left over from a larger value before.
    db
      .prepare("DELETE FROM source_metadata WHERE source = ? AND key = ? AND chunk >= ?")
      .bind(source, key, chunks.length),
  ];
  for (let index = 0; index < statements.length; index += BATCH_SIZE) {
    await db.batch(statements.slice(index, index + BATCH_SIZE));
  }
};

const loadSourceMetadata = async (db, source, key) => {
  const { results } = await db
    .prepare("SELECT value FROM source_metadata WHERE source = ? AND key = ? ORDER BY chunk")
    .bind(source, key)
    .all();
  return results.length ? Object.assign({}, ...results.map((row) => JSON.parse(row.value))) : null;
};

export { loadSourceMetadata, saveSourceMetadata };
