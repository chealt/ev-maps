# Architecture

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) (required)
- **Framework**: [Astro v7](https://astro.build/) (static output)
- **Components**: Native Web Components (behavior only, no shadow DOM)
- **Maps**: Google Maps JavaScript API
- **Backend**: a Cloudflare Worker (`packages/worker`) with a
  [D1](https://developers.cloudflare.com/d1/) database (SQLite) and an R*Tree
  spatial index
- **Charger data**: [Open Charge Map](https://openchargemap.org) and
  [OpenStreetMap](https://www.openstreetmap.org), imported on a schedule
- **Clustering**: [supercluster](https://github.com/mapbox/supercluster)
- **Icons**: [Lucide](https://lucide.dev/) via `lucide-static`
- **Styling**: Vanilla CSS with native nesting
- **Linting** (all Rust): [oxlint](https://oxc.rs/docs/guide/usage/linter)
  (JS), [Biome](https://biomejs.dev/) (CSS), [rumdl](https://rumdl.dev/)
  (Markdown)
- **Formatting** (Rust): [oxfmt](https://oxc.rs/docs/guide/usage/formatter)
  for all files, including `.astro` via `@astrojs/compiler-rs`
- **Testing**: [Playwright](https://playwright.dev/)
- **Deployment**: [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/)
  (static assets)

## Project Structure

```text
ev-maps/
├── packages/
│   ├── app/                           # The app (static site)
│   │   ├── astro.config.mjs
│   │   ├── playwright.config.js
│   │   ├── .env.example
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── HomePage.astro
│   │   │   │   ├── app-header/        # Brand header (Astro only)
│   │   │   │   ├── button/            # Generic button (Astro only)
│   │   │   │   ├── filter-button/     # <ev-filter-button>
│   │   │   │   ├── google-map/        # <ev-google-map>, charger data, clustering
│   │   │   │   ├── icon/              # Lucide icon wrapper (Astro only)
│   │   │   │   ├── locate-button/     # <ev-locate-button>
│   │   │   │   ├── theme-picker/      # <ev-theme-picker>
│   │   │   │   └── user-menu/         # <ev-user-menu>: sign-in and account menu
│   │   │   ├── config/app.config.js   # Map defaults and env-based settings
│   │   │   ├── layouts/               # Layout.astro + global.css (design tokens)
│   │   │   └── pages/index.astro
│   │   └── tests/                     # Playwright tests
│   │       └── fixtures/              # Fakes for the external APIs
│   ├── worker/                        # The Cloudflare Worker
│   │   ├── wrangler.toml              # Worker config; serves app/dist as assets
│   │   ├── migrations/                # D1 database migrations
│   │   └── src/                       # Charger API, first load, import
│   ├── tiles/                         # Tile maths shared by the app and Worker
│   ├── biome-plugin-css-units/        # Biome plugin: disallowed CSS units
│   └── dev-config/                    # Shared oxlint, oxfmt, Biome and rumdl configs
├── .github/workflows/
│   ├── app.yml                        # CI for the app, and the deploy
│   └── worker.yml                     # CI for the Worker
├── docs/                              # Developer documentation
└── package.json                       # Workspace root (tooling lives here)
```

## How It Works

- **Rendering**: Astro renders all HTML and CSS at build time. Web Components
  only add behavior to that markup; see the
  [Development Guidelines](DEVELOPMENT_GUIDELINES.md).
- **Import**: every 15 minutes, the Worker's scheduled handler
  (`packages/worker/src/import/`) works through due import jobs: Open Charge
  Map one country per job (Eastern Europe first; only openly licensed data providers)
  and OpenStreetMap one 1°×1° cell of Eastern Europe per job (via Overpass).
  Each area is refreshed weekly; chargers a source no longer lists are
  removed. Every charger keeps its source and license.
- **Chargers**: when the map stops moving, `google-map/chargers.js` loads the
  visible area's tiles from `/api/chargers/{z}/{x}/{y}`, which reads D1
  through the R*Tree index and merges duplicates (the same charger from two
  sources within 60 m). A full tile is split into smaller tiles. Tiles are
  cached at the edge for a day and in the browser by the service worker.
- **First load**: the Worker adds the visitor's approximate (IP based)
  location and the chargers nearest to it to the static page, so the first
  view needs no extra request.
- **Clustering**: `supercluster` groups nearby chargers; only the clusters and
  chargers in view are drawn as markers.
- **Sign-in**: `<ev-user-menu>` uses Google Identity Services. The ID token is
  decoded in the browser; there is no backend.
- **Themes**: every color token is defined once with `light-dark()`;
  `<ev-theme-picker>` sets `data-theme` on `<html>` and the map follows with
  Google Maps' color scheme.
