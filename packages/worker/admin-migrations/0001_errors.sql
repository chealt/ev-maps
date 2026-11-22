-- Errors from the Worker and the pages (src/errors.js), for the admin area.
-- A fingerprint groups the same error; rows older than 30 days are deleted.
CREATE TABLE errors (
  id INTEGER PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  -- "worker" or "page"
  source TEXT NOT NULL,
  name TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  -- Where it happened: the page or the request's URL, and for requests the
  -- method; for jobs, what ran (e.g. "import osm 47,19").
  url TEXT,
  method TEXT,
  context TEXT,
  user_agent TEXT,
  -- Signed-in user's ID, if any; no IP addresses.
  user_id TEXT,
  country TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX errors_created_at ON errors (created_at);
CREATE INDEX errors_fingerprint ON errors (fingerprint, created_at);
