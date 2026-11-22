-- Chargers users saved as favorites (src/favorites.js), with a copy of what
-- the favorites list shows (name, address, location...), so the list doesn't
-- need the chargers' tiles.
CREATE TABLE favorites (
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  charger_id TEXT NOT NULL,
  charger TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, charger_id)
);
