# Agent Guidelines

Instructions for coding agents (e.g. pi, which loads this file) working on
this repository. Follow [Contributing](CONTRIBUTING.md), the
[Development Guidelines](docs/DEVELOPMENT_GUIDELINES.md) and the
[Testing Guidelines](docs/TESTING_GUIDELINES.md) too.

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
