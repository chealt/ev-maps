-- The Playwright reports of CI runs (src/test-reports.js): CI uploads each
-- HTML report to R2 (REPORTS, reports/{id}/) and records it here. Kept 30
-- days, like the files (the bucket's lifecycle rule).
CREATE TABLE test_reports (
  -- "{run ID}-{attempt}"
  id TEXT PRIMARY KEY,
  branch TEXT,
  commit_sha TEXT NOT NULL,
  pull_request INTEGER,
  run_url TEXT,
  -- "passed" or "failed"
  status TEXT NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  flaky INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX test_reports_created_at ON test_reports (created_at);
