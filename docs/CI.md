# CI

Only **artifacts** get a workflow. An artifact is something this repo builds
and ships, such as the app deployed to Cloudflare. Each artifact's workflow
includes everything that artifact needs from CI.

- Don't add workflows for checks that aren't an artifact. For example, there
  is no workflow for linting Markdown in general. A Markdown lint workflow
  would only make sense if the linter itself were an artifact we build and
  ship.
- Packages that support an artifact, such as `packages/dev-config` and
  `packages/biome-plugin-css-units`, don't get their own workflow. Instead,
  the artifact's workflow runs when they change.
- Name the workflow after the artifact (`packages/app` uses `app.yml`,
  `packages/worker` uses `worker.yml`). Every artifact is its own package
  (see [Monorepo Packages](DEVELOPMENT_GUIDELINES.md#monorepo-packages)), so
  every Worker gets its own package and workflow.
- Run it for every push and pull request, and list the artifact, everything it
  depends on (e.g. `packages/dev-config`, the root `package.json` and
  `bun.lock`) and the workflow file itself in its `Detect app changes` job.
  Don't put `paths` filters on the triggers: required checks would never
  report for other changes, and those pull requests couldn't be merged.
- Run the artifact's own scripts with `working-directory` set to its package.
- Scheduled work goes in a workflow of its own, named after what it does, that
  starts the artifact's workflow (`workflow_dispatch`) instead of copying its
  jobs. Don't add `schedule` triggers to an artifact's workflow.

## Workflows

| Workflow     | Artifact          | Jobs                                                             |
| ------------ | ----------------- | ---------------------------------------------------------------- |
| `app.yml`    | `packages/app`    | JS lint, CSS lint, format check, build, Playwright tests, deploy |
| `worker.yml` | `packages/worker` | JS lint, format check, unit tests (`bun test`), bundle           |

Both also lint and format-check `packages/tiles`, which they share.
`app.yml` also lints and format-checks `packages/ui`, the generic UI
components the app's pages use.

| Workflow      | Schedule             | What it does                                               |
| ------------- | -------------------- | ---------------------------------------------------------- |
| `refresh.yml` | Mondays at 03:00 UTC | Runs `app.yml` on `main`, which rebuilds the country pages |

A run of `app.yml` started this way, or by hand, checks, builds and deploys
everything, without change detection. On `main` it deploys to production;
started on another branch, it doesn't deploy. Its `Build` job exports the
chargers from the production database for the country pages (except for pull
requests from forks, which build without them).

The lint, format, build and test jobs run in parallel; `Deploy` runs after all
of them pass. The Worker serves the app's build, so the two are deployed
together, by `app.yml`'s `Deploy` job from `packages/worker`. That's why
`app.yml` also runs when `packages/worker` changes.

After each production deploy, the `Release` job creates a GitHub release,
tagged with the date and time (`v2026.11.22-1705`, UTC). Its notes list the
pull requests merged since the previous release, grouped by kind (new
features, bug fixes, …), from their Conventional Commit titles
(`scripts/release-notes.js`). Changes that deploy nothing, such as docs, go
into the next release. The notes also link the run's Playwright,
accessibility and performance reports (in the admin area), with their
totals. To preview the notes: `bun scripts/release-notes.js <previous tag>`.

The Playwright tests run in 5 shards in parallel (`Test shard 1/5` …), each
saving a blob report. The `Test` job, the required check, merges them
(`playwright merge-reports`) into one HTML report and fails if any shard did.
The config's `fullyParallel` splits the shards by test, not by file, so each
shard gets about as many. To change the number of shards, edit the matrix in
`app.yml`. Locally: `bunx playwright test --shard=1/5`.

Each shard caches Playwright's Chromium per Playwright version, so most
runs skip downloading it and only install its system libraries.

The Playwright HTML report, with videos of every test and traces of failures,
is uploaded as the `playwright-report` artifact, and published for the admin
area with a commit status linking to it; see
[Test reports](features/test-reports.md).

### Visual review

The `@ui` tests' screenshots are matched against `main`'s with Playwright's
own `toHaveScreenshot`, in the tests themselves: `captureUi`
(`packages/e2e/src/test.js`) does it for each moment it captures, when
`VISUAL_COMPARE` is set.

- On `main`, the test shards run with `--update-snapshots=all`, so the
  screenshots become the baselines, and upload them to the reports bucket
  (`reports/ui-baseline/main/`, `scripts/visual-baseline.js upload`).
- A pull request's shards download them first (`… download`, into
  `packages/app/visual-baseline/`, the config's `snapshotPathTemplate`) and
  run with `--update-snapshots=none`. A moment that differs from `main`'s, or
  that `main` doesn't have, doesn't fail its test: `captureUi` marks it with
  a `visual-change` annotation, and Playwright attaches the expected, actual
  and diff images to the test in the report.
- After the report is published, `scripts/visual-review.js` sets the
  **Visual review** commit status, linking to the report: green when nothing
  changed, pending when something did. It also **comments the changes on the
  pull request**: for each, `main`'s screenshot and the pull request's side by
  side, the diff under them, and a link to the test in the report
  (`#?testId=…`). The images are published in the report's public `ui/`
  folder. A later run without changes updates the comment to say so.
- Before comparing, `captureUi` waits for animations and scrolling to stop.
  Tests end each captured moment at the same scroll position every run (see
  the Testing Guidelines), so a scroll-only difference is a real change.
- While it's pending, the **Visual approval** job waits on the
  `visual-review` environment, which requires a reviewer. Look at the
  report, then approve the job (**Review deployments** on the run): the
  status turns green, naming who approved.

**Visual review** is a required check, so a pull request whose screenshots
changed can't be merged until a person has approved the changes. A new push
compares again, so an approval covers only the screenshots it was given for.

When no app files changed, the Test job sets it green ("nothing to compare").

When nothing the app depends on changed (e.g. a docs-only pull request), the
checks still run so they report, but skip their steps and pass in seconds, and
nothing is deployed. If change detection fails, the checks fail instead of
skipping, because a skipped check counts as passed.

A newer commit on a pull request cancels the older runs. Runs on `main` are
never cancelled, so every app change gets deployed.

Checks that aren't part of an artifact, such as linting root Markdown, run
locally with `bun run lint` and `bun run format:check`.

The secrets and variables CI needs are listed in
[Deployment](DEPLOYMENT.md#github-secrets-and-variables).

On pull requests, the test shards run only the end-to-end tests related to
what changed, and the `@regression` tests; see
[Which Tests a Pull Request Runs](TESTING_GUIDELINES.md#which-tests-a-pull-request-runs).
