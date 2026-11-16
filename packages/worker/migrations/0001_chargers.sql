-- Chargers from every source. `rid` is the R*Tree row id; (source,
-- source_id) identifies a charger within its source.
CREATE TABLE chargers (
  rid INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  country TEXT,
  name TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  address TEXT,
  operator TEXT,
  usage_type TEXT,
  usage_cost TEXT,
  status TEXT,
  number_of_points INTEGER,
  max_power_kw REAL,
  connectors TEXT NOT NULL DEFAULT '[]',
  license TEXT,
  -- When the source last listed the charger; ones it no longer lists are
  -- removed when an import of their area finishes.
  seen_at INTEGER NOT NULL,
  UNIQUE (source, source_id)
);

-- Spatial index: a charger is a point, so min = max.
CREATE VIRTUAL TABLE chargers_rtree USING rtree (id, min_lat, max_lat, min_lng, max_lng);

-- Resumable import jobs: one per source and area (a country or a grid cell).
CREATE TABLE import_jobs (
  source TEXT NOT NULL,
  area TEXT NOT NULL,
  -- Lower runs first (e.g. Eastern Europe before the rest of the world).
  priority INTEGER NOT NULL DEFAULT 1,
  -- Where to continue, e.g. the last imported id.
  cursor TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  error TEXT,
  PRIMARY KEY (source, area)
);

CREATE INDEX chargers_by_source_country ON chargers (source, country);
