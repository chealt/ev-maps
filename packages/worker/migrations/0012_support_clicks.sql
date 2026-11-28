-- Clicks on the account menu's support links (src/support-clicks.js), for
-- the admin area's sponsor stats (#420): a count per platform and day, with
-- nothing about who clicked (no user ID, no IP address).
CREATE TABLE support_clicks (
  -- The UTC day, "YYYY-MM-DD".
  day TEXT NOT NULL,
  -- The platform's id in packages/app/src/lib/support-links.js.
  platform TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, platform)
);
