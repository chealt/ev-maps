# EV Maps

A web application for finding EV charging stations, built with **Astro** for
templating and **Web Components** for interactivity.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) (required)
- **Framework**: [Astro v4](https://astro.build/) (static output)
- **Components**: Native Web Components (behavior only, no shadow DOM)
- **Maps**: Google Maps JavaScript API + Places API (New)
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
│       │   │   ├── google-map/      # <ev-google-map> + Maps/Places helpers
│       │   │   └── locate-button/   # <ev-locate-button>
│       │   ├── config/app.config.js # Map defaults and env-based settings
│       │   ├── layouts/             # Layout.astro + global.css
│       │   └── pages/index.astro
│       └── tests/                   # Playwright tests (Google Maps is faked)
├── .github/workflows/app.yml         # CI/CD for the app artifact
├── docs/DEVELOPMENT_GUIDELINES.md
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
   Google Maps API key:

   ```bash
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

   The key needs the **Maps JavaScript API** and **Places API (New)**
   enabled. It is embedded in the generated page, so restrict it to your
   site's HTTP referrers in the Google Cloud console.

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

Tests replace the Google Maps script with a local fake
(`tests/fixtures/fake-google-maps.js`), so they need neither an API key nor
network access.

## Deployment

### Cloudflare Pages

Connect the repository to Cloudflare Pages with these build settings:

- Build command: `bun run build`
- Build output directory: `packages/app/dist`
- Environment variable: `VITE_GOOGLE_MAPS_API_KEY` (plus the optional ones
  above)

Or deploy manually:

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
- Packages that support an artifact, such as `packages/dev-config`, don't get
  their own workflow. Instead, the artifact's workflow runs when they change.
- Name the workflow after the artifact (`packages/app` uses `app.yml`).
- Trigger it with `paths` filters on the artifact, everything it depends on
  (e.g. `packages/dev-config`, the root `package.json` and `bun.lock`) and the
  workflow file itself.
- Run the artifact's own scripts with `working-directory` set to its package.

Currently there is one workflow:

| Workflow  | Artifact       | Runs                                                                       |
| --------- | -------------- | -------------------------------------------------------------------------- |
| `app.yml` | `packages/app` | JS and CSS lint, CSS variable check, format check, build, Playwright tests |

Checks that aren't part of an artifact, such as linting root Markdown, run
locally with `bun run lint` and `bun run format:check`.

To build the app with a real key in CI, add a `VITE_GOOGLE_MAPS_API_KEY`
repository secret.

## Development Guidelines

See **[Development Guidelines](docs/DEVELOPMENT_GUIDELINES.md)** for
component architecture, CSS conventions, code quality and commit message
rules.

## Contributing

**Always create a pull request with your changes.** Never commit or push
directly to `main`, even for small fixes or documentation updates, so every
change can be reviewed before it's merged.

1. Fork the repository
2. Create a feature branch
3. Make your changes (following the guidelines above)
4. Run `bun run lint`, `bun run format` and `bun run test`
5. Commit your changes using Conventional Commits
6. Open a pull request

## License

MIT
