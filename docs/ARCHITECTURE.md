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
│   │   │   ├── i18n/                  # Copy per language: en.js, pl.js, hu.js
│   │   │   ├── layouts/               # Layout.astro + global.css (design tokens)
│   │   │   ├── legal/                 # Privacy policy and terms, per language
│   │   │   ├── lib/                   # messages.js (runtime copy), pages.js
│   │   │   └── pages/                 # /{lang}/ and /{lang}/{country}/
│   │   ├── data/chargers/             # Exported chargers per country (git-ignored)
│   │   └── tests/                     # Playwright tests
│   │       └── fixtures/              # Fakes for the external APIs
│   ├── worker/                        # The Cloudflare Worker
│   │   ├── wrangler.toml              # Worker config; serves app/dist as assets
│   │   ├── migrations/                # D1 database migrations
│   │   ├── scripts/                   # export-chargers.js: D1 to JSON per country
│   │   └── src/                       # Charger API, sign-in, redirect for /, import
│   ├── tiles/                         # Tile maths shared by the app and Worker
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
  visible area's tiles from `/api/chargers/{z}/{x}/{y}`, which reads D1 through
  the R*Tree index and merges each charger's records from different sources
  (within 60 m) into one: every field comes from the best source that has it
  (official registers such as EIPA and IRVE first, then Open Charge Map, then
  OpenStreetMap), and the charger lists all of its sources, which the page
  credits. Access, status and connector types are sent as IDs, which the page
  translates. A full tile is split into smaller tiles. Tiles are cached at the
  edge for a day and in the browser by the service worker.
- **Country pages**: every page is under its language: `/en/` is the map
  without data, and `/en/hu/`, `/en/pl/`, … are static pages, one per
  country with chargers. Each contains the country's chargers, built from an
  export of D1 (`packages/worker/scripts/export-chargers.js`); a country with
  more than 4,000 gets an even spread of them (the fastest in each area), as
  Cloudflare serves files up to 25 MiB. The map starts on the country and
  shows them right away, also when zoomed out too far to load tiles; zoomed
  in, it loads the area's tiles as usual. The country pages are rebuilt every
  week (`refresh.yml`) and on every deploy.
- **Languages**: English, Polish and Hungarian, each built as its own static
  pages (`/en/`, `/pl/`, `/hu/`); see
  [Languages](DEVELOPMENT_GUIDELINES.md#languages). Google Maps loads in the
  page's language, and the account menu links to the page in the other
  languages.
- **Language and country**: the Worker redirects `/` to
  `/{language}/{country}/`: the language picked in the account menu (the
  `ev-maps-language` cookie), else the first language in the browser's
  `Accept-Language` that has pages, else English; and the country of the
  visitor's IP address (Cloudflare's `request.cf.country`). Without a page for
  that country it redirects to `/{language}/`. It only picks the URL; every
  page is served as a static file.
- **Live availability**: sources that publish it are polled (EIPA every 5
  minutes, France's IRVE every 15) (`packages/worker/src/live-status.js`), and
  each source's statuses are stored as a few rows (split by charger ID), so a
  refresh is a few writes. When a charger's details open, the page asks
  `/api/chargers/status` for its records' statuses and shows how many points are
  free, keeping them in memory for a minute; they never go into the cached tiles
  or the service worker's cache.
- **Countries**: Open Charge Map gives each charger's country; OpenStreetMap
  chargers get it from their location, with
  [country-coder](https://github.com/rapideditor/country-coder).
- **Route planner**: the Route button opens `<ev-route-planner>`, with From
  and To fields (`<ev-place-input>`) that suggest places with Google's Places
  API (New). Google's Routes library plans the route, and the Worker's
  `POST /api/chargers/route` returns the chargers within 5 km of it, in order
  along the route: it splits the route into chunks of about 20 km, queries the
  R*Tree for each chunk's box in one D1 batch, and measures each charger's
  distance to the route (`packages/worker/src/route.js`). The map then shows
  the route and its chargers, with the same power filters, until the route is
  cleared.
- **Clustering**: `supercluster` groups nearby chargers; only the clusters and
  chargers in view are drawn as markers.
- **Sign-in**: the button in the top-right corner opens the account menu, with
  the sign-in options, the theme and the language (signed in: the profile and
  Sign out). Signing in goes through the Worker's
  [Better Auth](https://www.better-auth.com) (`/api/auth/*`): the provider's
  OAuth page, then back to the same page with an httpOnly session cookie.
  Users, accounts and sessions are in D1, and the page reads the session from
  `/api/auth/get-session` on every load.
- **Installable app**: each language has a web app manifest
  (`/{lang}/manifest.webmanifest`) whose start URL is `/`, so the installed
  app opens in the user's language and country. Its PNG icons are generated
  from `public/favicon.svg` with `bun run icons` in `packages/app`.
- **Legal pages**: the privacy policy and terms of use, one Markdown file per
  language (`src/legal/{lang}/`), built as `/{lang}/privacy/` and
  `/{lang}/terms/` and linked from the account menu. Crawlers are kept out as
  the terms say: `public/robots.txt`, `noai` headers and meta tags.
- **Themes**: every color token is defined once with `light-dark()`;
  `<ev-theme-picker>` sets `data-theme` on `<html>` and the map follows with
  Google Maps' color scheme.
