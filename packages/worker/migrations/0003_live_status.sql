-- Live availability from the sources that publish it (e.g. EIPA), one row per
-- source, replaced every few minutes: `data` is JSON, by charger ID, of
-- [available, occupied, out of service, total] charging points. One row
-- keeps the writes per refresh at one.
CREATE TABLE charger_status_snapshots (
  source TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Lookup data an importer keeps for its status refreshes, e.g. which EIPA
-- charging point belongs to which pool (charger).
CREATE TABLE source_metadata (
  source TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (source, key)
);
