# EV Maps

A web application for finding EV charging stations, built with **Astro** for
templating and **Web Components** for interactivity.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) (required)
- **Framework**: [Astro v4](https://astro.build/) (static output)
- **Components**: Native Web Components (behavior only, no shadow DOM)
- **Maps**: Google Maps JavaScript API
- **Charger data**: [Open Charge Map](https://openchargemap.org) API,
  cached in the browser for 24 hours
- **Styling**: Vanilla CSS with native nesting
- **Linting** (all Rust): [oxlint](https://oxc.rs/docs/guide/usage/linter)
  (JS), [Biome](https://biomejs.dev/) (CSS), [rumdl](https://rumdl.dev/)
  (Markdown)
- **Formatting** (Rust): [oxfmt](https://oxc.rs/docs/guide/usage/formatter)
  for all files, including `.astro` via `@astrojs/compiler-rs`
- **Testing**: [Playwright](https://playwright.dev/)
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com/)

## Project Structure

```text
ev-maps/
├── packages/
│   ├── biome-plugin-css-units/      # Biome plugin: disallowed CSS units
│   │   ├── biome-manifest.json
│   │   └── no-disallowed-css-units.grit
│   ├── dev-config/                  # Shared tool configs
│   │   ├── .oxfmtrc.json
│   │   ├── .rumdl.toml
│   │   ├── biome.json
│   │   └── oxlint.json
│   └── app/                         # Main application
│       ├── astro.config.mjs
│       ├── playwright.config.js
│       ├── wrangler.toml            # Cloudflare Pages config
│       ├── .env.example
│       ├── src/
│       │   ├── components/
│       │   │   ├── HomePage.astro
│       │   │   ├── button/          # Generic button (Astro only)
│       │   │   ├── filter-button/   # <ev-filter-button>
│       │   │   ├── google-map/      # <ev-google-map> + Maps and charger data
│       │   │   └── locate-button/   # <ev-locate-button>
│       │   ├── config/app.config.js # Map defaults and env-based settings
│       │   ├── layouts/             # Layout.astro + global.css
│       │   └── pages/index.astro
│       └── tests/                   # Playwright tests (external APIs are faked)
├── .github/workflows/app.yml         # CI/CD for the app artifact
├── docs/
│   ├── DEVELOPMENT_GUIDELINES.md
│   └── TESTING_GUIDELINES.md
└── package.json                     # Workspace root (tooling lives here)
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) 1.4.4+: `curl -fsSL https://bun.sh/install | bash`
- [Node.js](https://nodejs.org/) 22+

### Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone git@github.com:chealt/ev-maps.git
   cd ev-maps
   bun install
   ```

2. Copy `packages/app/.env.example` to `packages/app/.env` and set your
   API keys:

   ```bash
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   VITE_OPEN_CHARGE_MAP_API_KEY=your_api_key_here
   ```

   - The Google key needs the **Maps JavaScript API** enabled. It is embedded
     in the generated page, so restrict it to your site's HTTP referrers in
     the Google Cloud console.
   - Get an Open Charge Map key at
     <https://openchargemap.org/site/develop/api>. It is also embedded in the
     page.

   Optional settings:

   - `VITE_GOOGLE_MAPS_MAP_ID`: a Map ID for advanced markers (defaults to
     Google's `DEMO_MAP_ID`)
   - `VITE_GOOGLE_CLIENT_ID`: an OAuth client ID to show a
     "Sign in with Google" button

3. Start the development server at `http://localhost:4321/`:

   ```bash
   bun run dev
   ```

## Scripts

Run from the repository root:

| Script                    | Description                                   |
| ------------------------- | --------------------------------------------- |
| `bun run dev`             | Start development server                      |
| `bun run build`           | Build for production into `packages/app/dist` |
| `bun run preview`         | Preview production build                      |
| `bun run test`            | Run Playwright tests                          |
| `bun run lint`            | Lint JS, CSS and Markdown                     |
| `bun run lint:md`         | Lint Markdown only                            |
| `bun run format`          | Format code                                   |
| `bun run format:check`    | Check formatting                              |
| `bun run format:md`       | Format Markdown only                          |
| `bun run format:md:check` | Check Markdown formatting only                |

Before running tests for the first time, install the browser:

```bash
cd packages/app && bunx playwright install chromium
```

Tests replace Google Maps, Google sign-in and Open Charge Map with local
fakes (`tests/fixtures/`), so they need neither API keys nor network access.
Before writing tests, read the
**[Testing Guidelines](docs/TESTING_GUIDELINES.md)**.

## Deployment

### Cloudflare Pages

The `Deploy` job in `.github/workflows/app.yml` deploys the app to the
`ev-maps` Cloudflare Pages project once lint, build and tests pass:

- **Pushes to `main`** deploy to production.
- **Pull requests** from this repository get a preview deployment; its URL
  shows on the pull request. Pull requests from forks are not deployed.

It deploys the `ev-maps-dist` artifact from the `Build` job, so the app is
built in GitHub Actions, not by Cloudflare. It needs these GitHub settings
(**Settings → Secrets and variables → Actions**):

| Name                           | Type     | Purpose                                                  |
| ------------------------------ | -------- | -------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`         | Secret   | API token with the **Cloudflare Pages: Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID`        | Secret   | Cloudflare account ID                                    |
| `VITE_GOOGLE_MAPS_API_KEY`     | Secret   | Google Maps key, built into the page                     |
| `VITE_OPEN_CHARGE_MAP_API_KEY` | Secret   | Open Charge Map key, built into the page                 |
| `VITE_GOOGLE_MAPS_MAP_ID`      | Variable | Optional Map ID (defaults to `DEMO_MAP_ID`)              |
| `VITE_GOOGLE_CLIENT_ID`        | Variable | Optional OAuth client ID for Google sign-in              |

The Cloudflare Pages project must be named `ev-maps` with `main` as its
production branch, and must not build the repository itself.

To deploy by hand:

```bash
bun run build
cd packages/app && bunx wrangler pages deploy
```

## CI

Only **artifacts** get a workflow. An artifact is something this repo builds
and ships, such as the app deployed to Cloudflare Pages. Each artifact's
workflow includes everything that artifact needs from CI.

- Don't add workflows for checks that aren't an artifact. For example, there
  is no workflow for linting Markdown in general. A Markdown lint workflow
  would only make sense if the linter itself were an artifact we build and
  ship.
- Packages that support an artifact, such as `packages/dev-config` and
  `packages/biome-plugin-css-units`, don't get their own workflow. Instead,
  the artifact's workflow runs when they change.
- Name the workflow after the artifact (`packages/app` uses `app.yml`).
- Trigger it with `paths` filters on the artifact, everything it depends on
  (e.g. `packages/dev-config`, the root `package.json` and `bun.lock`) and the
  workflow file itself.
- Run the artifact's own scripts with `working-directory` set to its package.

Currently there is one workflow:

| Workflow  | Artifact       | Runs (as parallel jobs)                                  |
| --------- | -------------- | -------------------------------------------------------- |
| `app.yml` | `packages/app` | JS lint, CSS lint, format check, build, Playwright tests |

Checks that aren't part of an artifact, such as linting root Markdown, run
locally with `bun run lint` and `bun run format:check`.

To build the app with real keys in CI, add `VITE_GOOGLE_MAPS_API_KEY` and
`VITE_OPEN_CHARGE_MAP_API_KEY` repository secrets.

## Development Guidelines

See **[Development Guidelines](docs/DEVELOPMENT_GUIDELINES.md)** for
component architecture, CSS conventions, code quality and commit message
rules.

See **[Testing Guidelines](docs/TESTING_GUIDELINES.md)** for how to write
Playwright tests: find elements by accessible role, label or text (never CSS
selectors or test IDs), and don't check layout or visual appearance.

## Contributing

**Always create a pull request with your changes.** Never commit or push
directly to `main`, even for small fixes or documentation updates, so every
change can be reviewed before it's merged.

1. Fork the repository
2. Create a feature branch
3. Make your changes (following the development and testing guidelines)
4. Run `bun run lint`, `bun run format` and `bun run test`
5. Commit your changes using Conventional Commits
6. Open a pull request

## License

MIT
