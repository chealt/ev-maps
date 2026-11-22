# Architecture

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) (required)
- **Framework**: [Astro v7](https://astro.build/) (static output)
- **Components**: Native Web Components (behavior only, no shadow DOM)
- **Maps**: Google Maps JavaScript API
- **Backend**: a Cloudflare Worker (`packages/worker`) with a
  [D1](https://developers.cloudflare.com/d1/) database (SQLite) and an R*Tree
  spatial index
- **Charger data**: [Open Charge Map](https://openchargemap.org),
  [OpenStreetMap](https://www.openstreetmap.org) and the official registers
  of Poland ([EIPA](https://eipa.udt.gov.pl)) and France
  ([IRVE](https://transport.data.gouv.fr)), imported on a schedule; both
  registers also publish live availability
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
│   │   │   │   ├── button/            # Generic button (Astro only)
│   │   │   │   ├── filter-button/     # <ev-filter-button>
│   │   │   │   ├── google-map/        # <ev-google-map>, charger data, clustering
│   │   │   │   ├── icon/              # Lucide icon wrapper (Astro only)
│   │   │   │   ├── language-picker/   # <ev-language-picker>: links to other languages
│   │   │   │   ├── locate-button/     # <ev-locate-button>
│   │   │   │   ├── place-input/       # <ev-place-input>: place search combobox
│   │   │   │   ├── route-button/      # <ev-route-button>
│   │   │   │   ├── route-planner/     # <ev-route-planner>: From, To, Show route
│   │   │   │   ├── theme-picker/      # <ev-theme-picker>
│   │   │   │   └── user-menu/         # <ev-user-menu>: sign-in and account menu
│   │   │   ├── config/app.config.js   # Map defaults and env-based settings
│   │   │   ├── i18n/                  # Copy: {language}/{section}.js
│   │   │   ├── layouts/               # Layout.astro + global.css (design tokens)
│   │   │   ├── legal/                 # Privacy policy and terms, per language
│   │   │   ├── lib/                   # messages.js (runtime copy), pages.js
│   │   │   └── pages/                 # /{lang}/ and /{lang}/{country}/
│   │   ├── data/chargers/             # Exported chargers per country (git-ignored)
│   │   └── tests/                     # Playwright tests
│   │       └── fixtures/              # Fakes for the external APIs
│   ├── worker/                        # The Cloudflare Worker
│   │   ├── wrangler.toml              # Worker config; serves app/dist/client
│   │   ├── migrations/                # D1 database migrations
│   │   ├── scripts/                   # export-chargers.js: D1 to JSON per country
│   │   └── src/                       # Charger API, sign-in, redirect for /, import
│   ├── tiles/                         # Tile maths shared by the app and Worker
│   ├── ui/                            # Generic UI components (@ev-maps/ui)
│   ├── biome-plugin-css-units/        # Biome plugin: disallowed CSS units
│   └── dev-config/                    # Shared oxlint, oxfmt, Biome and rumdl configs
├── .github/workflows/
│   ├── app.yml                        # CI for the app, and the deploy
│   ├── worker.yml                     # CI for the Worker
│   └── refresh.yml                    # Weekly rebuild of the country pages
├── docs/                              # Developer documentation
└── package.json                       # Workspace root (tooling lives here)
```

## How It Works

Each feature, or group of features, has its own page in `docs/features/`, so
changes to different features don't touch the same file:

- [Pages](features/pages.md): how pages are built and served, country pages,
  themes, the installable app
- [Import](features/import.md): how chargers are imported from each source, and
  their countries
- [The map](features/map.md): loading chargers for the map, and clustering
- [Languages](features/languages.md): the three languages, and the redirect to
  the visitor's language and country
- [Live availability](features/live-availability.md): live statuses: polling the
  sources, and showing free points and red pins
- [Route planner](features/route-planner.md): planning a route and finding the
  chargers along it
- [Sign-in](features/sign-in.md): Better Auth, OAuth providers, email links and
  passkeys
- [Filters and settings](features/filters.md): the Filters dialog, and saving
  filters to the device and the account
- [Favorites](features/favorites.md): saving chargers, the favorites list, and
  the service worker's offline copy
- [Places next to chargers](features/nearby-places.md): cafés, toilets,
  restaurants and playgrounds near chargers, from OpenStreetMap
- [Admin area](features/admin.md): the admin area and who can use it
- [Errors](features/admin-errors.md): collecting errors and the errors page
- [Usage stats](features/admin-usage.md): collecting usage counts and the usage
  page
- [Performance](features/performance.md): traces from the page through the
  Worker to D1, and Core Web Vitals
- [Test reports](features/test-reports.md): CI's Playwright reports, published
  to R2 and listed for admins
- [The API: routes, access and rate limits](features/api.md): how the Worker
  routes API requests by domain, the guard, and rate limits
- [Legal pages](features/legal.md): the privacy policy and terms of use
