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
- Name the workflow after the artifact (`packages/app` uses `app.yml`).
- Run it for every push and pull request, and list the artifact, everything it
  depends on (e.g. `packages/dev-config`, the root `package.json` and
  `bun.lock`) and the workflow file itself in its `Detect changes` job.
  Don't put `paths` filters on the triggers: required checks would never
  report for other changes, and those pull requests couldn't be merged.
- Run the artifact's own scripts with `working-directory` set to its package.

## Workflows

| Workflow  | Artifact       | Jobs                                                             |
| --------- | -------------- | ---------------------------------------------------------------- |
| `app.yml` | `packages/app` | JS lint, CSS lint, format check, build, Playwright tests, deploy |

The lint, format, build and test jobs run in parallel; `Deploy` runs after all
of them pass.

When nothing the app depends on changed (e.g. a docs-only pull request), the
checks still run so they report, but skip their steps and pass in seconds, and
nothing is deployed. If change detection fails, the checks fail instead of
skipping, because a skipped check counts as passed.

A newer commit on a pull request cancels the older runs. Runs on `main` are
never cancelled, so every app change gets deployed. The Playwright HTML report, with videos of every test and traces
of failures, is uploaded as the `playwright-report` artifact.

Checks that aren't part of an artifact, such as linting root Markdown, run
locally with `bun run lint` and `bun run format:check`.

The secrets and variables CI needs are listed in
[Deployment](DEPLOYMENT.md#github-secrets-and-variables).
