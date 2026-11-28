-- Sponsorships from the platforms' webhooks (src/sponsorships.js), for the
-- admin area's sponsor stats and the sponsor badge (#420, #434).
-- GitHub Sponsors: one row per sponsorship, updated when its tier changes or
-- it's cancelled. Ko-fi: one row per payment (it sends no cancellations; each
-- monthly payment is its own row).
CREATE TABLE sponsorships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- "github-sponsors" or "ko-fi", as in packages/app/src/lib/support-links.js.
  platform TEXT NOT NULL,
  -- The platform's id: the sponsorship's node_id, or Ko-fi's transaction id.
  platform_id TEXT NOT NULL,
  -- When it started or was paid, ISO 8601.
  created_at TEXT NOT NULL,
  -- In cents of the currency; null when the platform doesn't say.
  amount_cents INTEGER,
  currency TEXT,
  tier TEXT,
  monthly INTEGER NOT NULL DEFAULT 0,
  -- "active" or "cancelled".
  status TEXT NOT NULL DEFAULT 'active',
  cancelled_at TEXT,
  -- The EV Maps account it's linked to, when one matched.
  user_id TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
  -- Who sponsored, as the platform says: the GitHub login, or the Ko-fi email.
  sponsor TEXT,
  UNIQUE (platform, platform_id)
);

CREATE INDEX sponsorships_user ON sponsorships (user_id);
