-- Live availability from the sources that publish it (e.g. EIPA), replaced
-- every few minutes. Each source's statuses are split into a few parts by
-- charger ID (src/partitions.js), so a refresh is a few writes and a row stays
-- well under D1's 2 MB: `data` is JSON, by charger ID, of [available,
-- occupied, out of service, total] charging points.
CREATE TABLE charger_status_snapshots (
  source TEXT NOT NULL,
  part INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (source, part)
);

-- Lookup data an importer keeps for its status refreshes, e.g. which EIPA
-- charging point belongs to which pool (charger), in chunks of JSON.
CREATE TABLE source_metadata (
  source TEXT NOT NULL,
  key TEXT NOT NULL,
  chunk INTEGER NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (source, key, chunk)
);
