# Architecture

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) (required)
- **Framework**: [Astro v4](https://astro.build/) (static output)
- **Components**: Native Web Components (behavior only, no shadow DOM)
- **Maps**: Google Maps JavaScript API
- **Charger data**: [Open Charge Map](https://openchargemap.org) API
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
│   ├── app/                           # The app
│   │   ├── astro.config.mjs
│   │   ├── playwright.config.js
│   │   ├── wrangler.toml              # Cloudflare Worker config
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
│   ├── biome-plugin-css-units/        # Biome plugin: disallowed CSS units
│   └── dev-config/                    # Shared oxlint, oxfmt, Biome and rumdl configs
├── .github/workflows/app.yml          # CI/CD for the app
├── docs/                              # Developer documentation
└── package.json                       # Workspace root (tooling lives here)
```

## How It Works

- **Rendering**: Astro renders all HTML and CSS at build time. Web Components
  only add behavior to that markup; see the
  [Development Guidelines](DEVELOPMENT_GUIDELINES.md).
- **Chargers**: when the map stops moving, `google-map/chargers.js` loads the
  chargers for the visible area from Open Charge Map. The area is split into
  fixed map tiles; a tile that hits the result limit is split into smaller
  tiles. Responses and Open Charge Map's reference data are cached in the
  browser's Cache Storage for 24 hours.
- **Clustering**: `supercluster` groups nearby chargers; only the clusters and
  chargers in view are drawn as markers.
- **Sign-in**: `<ev-user-menu>` uses Google Identity Services. The ID token is
  decoded in the browser; there is no backend.
- **Themes**: every color token is defined once with `light-dark()`;
  `<ev-theme-picker>` sets `data-theme` on `<html>` and the map follows with
  Google Maps' color scheme.
