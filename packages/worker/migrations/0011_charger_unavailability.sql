-- Signed-in users flagging a charger as unavailable
-- (src/charger-unavailability.js), optionally with one photo as proof. A
-- user has at most one open flag per charger, so the admins' list counts
-- people. Confirming a charger's flags marks it temporarily unavailable.
CREATE TABLE charger_unavailability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_email TEXT,
  -- The charger as the app knows it ("source:source_id"), and its name then.
  charger_id TEXT NOT NULL,
  charger_name TEXT,
  -- A data URL, or NULL without a photo.
  photo TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);

CREATE INDEX charger_unavailability_by_charger ON charger_unavailability (status, charger_id);
CREATE UNIQUE INDEX charger_unavailability_open ON charger_unavailability (charger_id, user_id)
  WHERE status = 'pending';
