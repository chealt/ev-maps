-- Chargers' price history (#463), from the sources that publish live prices
-- (EIPA), gathered hourly (src/charger-prices.js). Only changes are stored:
-- a row is the price a charger had from `recorded_at` (the hour, in ms)
-- until its next row. `price` is the cheapest per kWh in the source's
-- currency, null while the source published none.
CREATE TABLE charger_prices (
  charger_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  price REAL,
  PRIMARY KEY (charger_id, recorded_at)
);

CREATE INDEX charger_prices_recorded_at ON charger_prices (recorded_at);

-- Each charger's latest row, so an hourly run compares with it in one read.
CREATE TABLE charger_price_latest (
  charger_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  price REAL,
  recorded_at INTEGER NOT NULL
);

CREATE INDEX charger_price_latest_source ON charger_price_latest (source);

-- When each source's prices were last gathered: a charger's history runs
-- until then.
CREATE TABLE charger_price_runs (
  source TEXT PRIMARY KEY,
  recorded_at INTEGER NOT NULL
);
