-- Usage, counted per day (src/usage.js): how often each event happened, by
-- one dimension (e.g. the page kind, the sign-in method). Counts only: no
-- identifiers, so nothing about any one person.
CREATE TABLE usage_daily (
  -- YYYY-MM-DD, UTC
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  dimension TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL,
  PRIMARY KEY (day, event, dimension)
);
