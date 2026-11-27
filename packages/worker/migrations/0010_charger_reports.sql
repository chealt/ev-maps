-- Changes to a charger's availability or price reported by signed-in users
-- (src/charger-reports.js), with proof: where their device was, a photo of
-- the charger and, for a price, of a receipt, an invoice or a charging app.
-- Admins review them; an approved one sets the charger's community values.
CREATE TABLE charger_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_email TEXT,
  -- The charger as the app knows it ("source:source_id"), and its name then.
  charger_id TEXT NOT NULL,
  charger_name TEXT,
  -- A status ID (src/charger-values.js), or NULL when not reported.
  availability TEXT,
  -- JSON: { free: true } or { amount, currency, unit }, or NULL.
  price TEXT,
  -- The device's location when reporting, and how far it was from the
  -- charger (meters).
  device_lat REAL NOT NULL,
  device_lng REAL NOT NULL,
  device_accuracy REAL,
  distance_m REAL,
  -- 0-100 (src/trust-score.js), and the points each factor gave (JSON).
  trust_score INTEGER NOT NULL,
  trust_factors TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);

CREATE INDEX charger_reports_by_status ON charger_reports (status, created_at DESC);
CREATE INDEX charger_reports_by_user ON charger_reports (user_id, status);

-- A report's photos, one per row (D1 limits a row's size): `kind` is
-- "charger" or "receipt"; `data` a data URL.
CREATE TABLE charger_report_photos (
  report_id INTEGER NOT NULL REFERENCES charger_reports (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (report_id, position)
);

-- The values of the latest approved report or suggestion, apart from the
-- source's: imports don't touch them, and reads prefer them (src/db.js).
ALTER TABLE chargers ADD COLUMN community_status TEXT;
ALTER TABLE chargers ADD COLUMN community_cost TEXT;
ALTER TABLE chargers ADD COLUMN community_updated_at INTEGER;

-- A new charger's suggestion can say its availability and price too, with
-- the same proof and trust score as a report: `receipt_photos` is a JSON
-- array of data URLs, served after `photos`.
ALTER TABLE charger_suggestions ADD COLUMN availability TEXT;
ALTER TABLE charger_suggestions ADD COLUMN receipt_photos TEXT;
ALTER TABLE charger_suggestions ADD COLUMN price TEXT;
ALTER TABLE charger_suggestions ADD COLUMN device_lat REAL;
ALTER TABLE charger_suggestions ADD COLUMN device_lng REAL;
ALTER TABLE charger_suggestions ADD COLUMN device_accuracy REAL;
ALTER TABLE charger_suggestions ADD COLUMN distance_m REAL;
ALTER TABLE charger_suggestions ADD COLUMN trust_score INTEGER;
ALTER TABLE charger_suggestions ADD COLUMN trust_factors TEXT;
