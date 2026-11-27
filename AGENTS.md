# Agent Guidelines

Instructions for coding agents (e.g. pi, which loads this file) working on
this repository. Follow [Contributing](CONTRIBUTING.md), the
[Development Guidelines](docs/DEVELOPMENT_GUIDELINES.md) and the
[Testing Guidelines](docs/TESTING_GUIDELINES.md) too.

## Pick Up Issues by Priority

When you choose which issue to work on, follow
[Picking Up Issues](CONTRIBUTING.md#picking-up-issues): the issue's
Priority field decides the order (Urgent, High, Medium, Low, then none),
and the oldest goes first within a priority.

## Test Only What You Changed

Locally, run only the tests for what you changed. **Don't run every test**
(the whole end-to-end suite, or all of a package's tests) after each
change: CI does that. A pull request runs the end-to-end specs of the
domains it changed plus the `@regression` tests, and `main` runs them all
(see [Which Tests a Pull Request Runs](docs/TESTING_GUIDELINES.md#which-tests-a-pull-request-runs)).

- **End-to-end specs:** run the specs of what you changed, by name, e.g.
  `cd packages/app && bunx playwright test route-planner favorite-routes`.
  `bun scripts/select-e2e.js` (in `packages/app`) lists the specs CI would
  pick for your branch.
- **Unit tests:** run the test files of what you changed, e.g.
  `bun test src/settings.test.js` in `packages/worker`, or
  `bun test src/lib/priciness.test.js` in `packages/app`.
- **Lint and formatting:** `bun run lint` and `bun run format:check` are
  quick; run them before you commit. `bun run lint:css` in `packages/app`
  when you changed CSS.
- **Build:** `bun run build` only when you changed what it builds from in a
  way the tests don't cover, e.g. the Astro config or a page's data.

Changing something shared (a fixture, the Playwright config, a layout)
makes CI run every test; locally, run the specs that use it and leave the
rest to CI. When CI fails, run the failing specs locally, not the suite.

## Each Spec in Its Domain's `test.describe`

Every end-to-end spec belongs to a domain of `packages/app/e2e-domains.json`,
and all of its tests sit in one `test.describe` named after that domain
(e.g. `test.describe("admin", () => { … })`), so the report groups them by
domain. Keep the block when you edit a spec, and add it to every new spec
(see [Which Tests a Pull Request Runs](docs/TESTING_GUIDELINES.md#which-tests-a-pull-request-runs)).
When you squash or rebase a branch, check that its diff against `main` is
only your change: a reset onto a newer `main` reverts what it gained.

## Setup and Expected Noise

- **Bun** may not be on the `PATH`: `export PATH=~/.bun/bin:$PATH`.
- **Formatting:** `bun run format` (the repository's oxfmt config), not a
  bare `bunx oxfmt`.
- **Issue priority:** the Priority is an issue field, not a label, and a
  `gh` token without `read:project` reads it through the REST
  `issue_field_values` or GraphQL with the `GraphQL-Features: issue_fields`
  header (the command is in [Picking Up Issues](CONTRIBUTING.md#picking-up-issues)).
- **Expected output:** "D1 is down" in the Worker's tests, and
  `[WebServer]` console errors in specs that test failures, are the tests'
  own; they don't mean a failure.
- **New E2E files and UI:** the "Check the E2E map" check fails on a file
  in no domain of `packages/app/e2e-domains.json`, or new UI without a
  `@ui` test that calls `captureUi`.
- **Pull requests are squash-merged:** a branch stacked on a merged one
  rebases with `git rebase --onto origin/main <old base>`.

## Sessions

Keep a session to one task (an issue or a pull request). When it's done
and the next one is unrelated, use the `handoff` tool (pi-config's
`handoff` extension) with a short brief, or ask the user to; this file and
the docs carry the conventions, so the new session doesn't need the old
history. The `/resolve-conflicts`, `/ship` and `/next-issue` prompts
(`packages/pi-config/prompts`) hold the repeated workflows.

Batch two or more independent lookups in one codemode script, and filter
large output (PR lists, test reports, logs) in the script or the shell
before it enters the context. Use direct calls for single steps, edits, and
anything whose result decides the next step.
