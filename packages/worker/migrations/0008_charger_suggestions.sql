-- Charger suggestions submitted by signed-in users, with a proof photo
-- and one or more chargers (connector types, speeds and quantities) at the
-- location; reviewed by admins and added to `chargers` on approval.
CREATE TABLE charger_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_email TEXT,
  name TEXT NOT NULL,
  address TEXT,
  operator TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  connectors TEXT NOT NULL DEFAULT '[]',
  photo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);

CREATE INDEX charger_suggestions_by_status ON charger_suggestions (status, created_at DESC);
