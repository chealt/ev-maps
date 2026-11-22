# Test reports

CI's Playwright reports, for admins only, kept 30 days.

## Publishing

The App workflow's Test job merges the test shards' blob reports into the
HTML report and a JSON summary (`playwright-results.json`), then runs
`packages/app/scripts/publish-test-report.js`:

1. uploads every file of the HTML report, with R2's S3 API, to the R2 bucket
   `ev-maps-test-reports`, under `reports/{run ID}-{attempt}/`, 16 at a time
   (Cloudflare's REST API);
2. records the run in the admin database (`test_reports`): branch, commit,
   pull request, the run's address, the result and its counts, how long it
   took; until a deploy from main has created the table, this only warns;
3. sets a commit status, "Playwright report", linking to the report, e.g.
   "158 passed, 0 failed, 1 flaky".

Pull requests from forks don't get the secrets, so their reports are only the
`playwright-report` artifact.

## Viewing

- `/{lang}/admin/reports/` lists the reports, the latest first, 20 a page,
  with links to the commit, the pull request and the report. A branch
  filter shows `main`'s reports until another branch (or all) is picked;
  the pick is remembered in this browser (IndexedDB, with `idb-keyval`).
  The API takes `?branch=` and lists the branches with reports, most
  recently run first.
- `/{lang}/admin/reports/{id}/…` serves the report's files from R2
  (`src/test-reports.js`, a page route), so the report's own links (`data/`,
  `trace/`) stay under it. Everyone but admins gets a 404, as for every admin
  page; nothing is cached by shared caches.

The bucket's lifecycle rule deletes the files after 30 days, and a job the
rows.

## Accessibility report

Every end-to-end test ends with an axe check of its page
(`tests/fixtures/test.js`), and attaches the results ("axe"). After
publishing the Playwright report, `scripts/a11y-report.js` puts them
together from `playwright-results.json` into one page: totals, the rules
violated, the rules to check by hand (where axe couldn't decide), and each
test's page. It's uploaded next to the report, in `reports/{id}/a11y/`, and
linked from its own commit status, "Accessibility report" (failure if any
rule was violated). Locally, after a run with the JSON reporter:
`bun scripts/a11y-report.js` in `packages/app`.
