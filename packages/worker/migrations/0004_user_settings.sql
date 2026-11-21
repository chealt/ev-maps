-- Settings users save to their account (src/settings.js), e.g. their
-- filters: JSON of sections, each with the time it was saved, so the newer
-- of a device's and the account's copy wins.
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
