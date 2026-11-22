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
  or the service worker's cache. Signed in, the page also asks for the
  statuses of the charger pins on the map (in batches of up to 100 IDs, again
  every 2 minutes while visible) and makes a pin red while none of its
  charger's points is free.
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
- **Sign-in**: the box in the top-right corner shows the app's name (the
  page's `<h1>`, visible for Google's OAuth verification) and the avatar;
  clicking anywhere on it opens the account menu, with
  the sign-in options, the theme and the language (signed in: the profile and
  Sign out). Signing in goes through the Worker's
  [Better Auth](https://www.better-auth.com) (`/api/auth/*`): the provider's
  OAuth page, then back to the same page with an httpOnly session cookie. Or
  an emailed link (Better Auth's magic link, sent with Resend), which verifies
  the address and creates the account the first time; signed in, the menu
  offers to add a passkey (WebAuthn, `@better-auth/passkey`), and "Sign in
  with a passkey" works from then on. Only users with a verified email count
  as signed in for the API (`userIdOf` in `src/auth.js`).
  Users, accounts and sessions are in D1, and the page reads the session from
  `/api/auth/get-session` on every load.
- **Filters and settings**: the Filters dialog has connector types (OR'ed:
  a charger needs one of them), power ranges and operators, which must all
  match. Operators are listed from the loaded chargers, all ticked, and the
  ones turned off are saved (`excludedOperators`), so new operators show. The
  choice is saved in IndexedDB with when it changed, and the Filters button
  shows how many filters are on. Signed in, each change is also saved to the
  account a second later (or as the dialog closes) with the Worker's
  `PUT /api/settings` (`packages/worker/src/settings.js`, D1 table
  `user_settings`). After signing in, the newer of the device's and the
  account's filters wins: the account's apply, or the device's are saved.
  Settings are sections (`filters`, later favorites and others), each with
  `updatedAt`, and the Worker keeps the newer copy of each.
- **Favorites**: signed in, the heart in a charger's details saves it to the
  Worker's `/api/favorites` (`packages/worker/src/favorites.js`, D1 table
  `favorites`, with a copy of the charger so the list needs no tiles), and
  `src/lib/favorites.js` keeps them in memory. The account menu's Favorites
  opens `<ev-favorites-dialog>`, which morphs out of the account box (a view
  transition) and lists them nearest to the map's center first; picking one
  shows it on the map. The Filters dialog's "Only favorites" hides the rest.
  Signed out, the heart, the menu item and the filter are disabled and ask to
  sign in. Where the service worker runs (`public/sw.js`), it sits in front of
  `/api/favorites`: changes go to IndexedDB and an outbox first and are
  answered at once, then sent to the Worker (right away, on Background Sync,
  and before the list is read); the list comes from the network, or from
  IndexedDB offline, with the unsent changes on top. Signing out clears both.
- **Places next to chargers**: the import's `amenities` jobs
  (`packages/worker/src/import/amenities.js`) ask OpenStreetMap's Overpass API,
  per 1°×1° cell with chargers, for cafés, toilets, restaurants (and fast
  food) and playgrounds (centers only), and store a bit per kind within 150 m
  in each charger's `amenities` column (`src/amenities.js`). The cells are
  listed at most daily, as that reads every charger, and refreshed weekly like
  the chargers. Tiles carry them as `amenities: ["coffee", ...]`; the details
  list them with OpenStreetMap's credit, and signed in, the Filters dialog's
  "Nearby" shows only chargers with every chosen kind (saved with the filters).
- **Admin area**: users with a verified email at `ADMIN_EMAIL_DOMAIN`
  (`chealt.com`, in `wrangler.toml`) are admins (`packages/worker/src/admin.js`).
  The Worker runs first for `/{lang}/admin*` and serves those pages only to
  admins (404 for everyone else, never cached), and the admin API
  (`/api/admin/*`, the guard's `admin` policy) answers only them (403
  otherwise). The account menu links admins to `/{lang}/admin/`.
- **Errors**: the Worker records what it doesn't handle (failing requests,
  scheduled runs, import and status jobs) and the pages report their uncaught
  errors and rejected promises (`src/lib/error-reporting.js`) to
  `POST /api/errors` (open, 30 per IP address per minute). They go to the
  separate admin database (`ev-maps-admin`, binding `ADMIN_DB`,
  `packages/worker/admin-migrations/`) with a fingerprint that groups the
  same error (`packages/worker/src/errors.js`), and are kept 30 days. Admins
  see them at `/{lang}/admin/errors/` (`<ev-admin-errors>`): the groups, most
  recently seen first, with counts, users, first and last seen, and each
  group's occurrences with the URL, browser, user, country, job and stack
  trace (`GET /api/admin/errors`, `/api/admin/errors/{fingerprint}`, 25 and 20
  a page).
- **Usage stats**: counts per day in the admin database (`usage_daily`,
  `packages/worker/src/usage.js`), no identifiers. The Worker counts sign-ups,
  sign-ins (Better Auth's database hooks), planned routes and favorites
  added; pages count page views (by language and kind), chargers opened,
  filters used, Locate me, the list and sign-in attempts
  (`src/lib/usage.js`) and send them batched to `POST /api/usage` (known
  events only, capped counts, 60 per IP address per minute), which adds the
  visitors' country. Kept about 13 months.
- **Installable app**: each language has a web app manifest
  (`/{lang}/manifest.webmanifest`) whose start URL is `/`, so the installed
  app opens in the user's language and country. Its PNG icons are generated
  from `public/favicon.svg` with `bun run icons` in `packages/app`.
- **Access and rate limits** (`packages/worker/src/guard.js`): bots and AI
  crawlers get a 403 from the whole API. The charger tiles and sign-in are
  open to everyone, limited per IP address; live availability, chargers along
  a route and account settings need a signed-in user, limited per user
  (Cloudflare's rate limiting, `ratelimits` in `wrangler.toml`). Signed out,
  the page shows those features with a sign-in button instead.
- **Legal pages**: the privacy policy and terms of use, one Markdown file per
  language (`src/legal/{lang}/`), built as `/{lang}/privacy/` and
  `/{lang}/terms/` and linked from the account menu. Crawlers are kept out as
  the terms say: `public/robots.txt`, `noai` headers and meta tags.
- **Themes**: every color token is defined once with `light-dark()`;
  `<ev-theme-picker>` sets `data-theme` on `<html>` and the map follows with
  Google Maps' color scheme.
