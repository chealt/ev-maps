# Getting Started

## Prerequisites

- [Bun](https://bun.sh/) 1.4.4+: `curl -fsSL https://bun.sh/install | bash`
- [Node.js](https://nodejs.org/) 26+ (the current LTS)

## Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone git@github.com:chealt/ev-maps.git
   cd ev-maps
   bun install
   ```

2. Copy `packages/app/.env.example` to `packages/app/.env.local` and set your
   Google Maps key, and create `packages/worker/.dev.vars` with your Open
   Charge Map key for the Worker:

   ```bash
   # packages/app/.env.local
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   # packages/worker/.dev.vars
   OPEN_CHARGE_MAP_API_KEY=your_api_key_here
   BETTER_AUTH_SECRET=any_long_random_value
   GOOGLE_CLIENT_SECRET=the_development_oauth_client_secret
   ```

   See [Environment Variables](#environment-variables) for what each one is
   and where to get it.

3. Start the development server at `http://localhost:4321/`. It also starts
   the API, the Cloudflare Worker with a local D1 database, on port 8787 and
   forwards `/api` to it:

   ```bash
   bun run dev
   ```

   Their output is prefixed with `astro` and `worker`. To run only one of
   them, use `bun run dev:app` or `bun run dev:worker`.

4. The local database starts empty. Run an import step (a scheduled run) to
   fill it; each run imports for `IMPORT_BUDGET_MS` (set it in `.dev.vars`,
   e.g. `90000`):

   ```bash
   curl "http://localhost:8787/__scheduled?cron=*/15+*+*+*+*"
   ```

5. The country pages (`/en/hu/`, `/en/pl/`, …) are built from an export of
   the chargers. Export the local database, or production's with `--remote`
   (needs `bunx wrangler login`), then restart `bun run dev`:

   ```bash
   bun run export:chargers
   ```

   The export reads the database through Wrangler's `getPlatformProxy()`,
   with Node: Wrangler's remote bindings don't work under Bun. The files go to
   `packages/app/data/chargers/`, which git ignores. Without
   them there are no country pages, only `/en/`. Locally `/` redirects to
   `/en/`; the redirect to the visitor's country needs the Worker
   (`http://localhost:8787/`, after `bun run build`).

## Environment Variables

The `VITE_` ones (`packages/app/.env.local`) are built into the page, so none
of them is secret once deployed. The Worker's (`packages/worker/.dev.vars`) stay
on the server.

| Name                       | Where  | Required | Purpose                                                                       |
| -------------------------- | ------ | -------- | ----------------------------------------------------------------------------- |
| `VITE_GOOGLE_MAPS_API_KEY` | Page   | Yes      | Google Maps key with the Maps JavaScript, Places (New) and Routes APIs        |
| `VITE_GOOGLE_MAPS_MAP_ID`  | Page   | No       | Map ID for advanced markers (defaults to Google's `DEMO_MAP_ID`)              |
| `OPEN_CHARGE_MAP_API_KEY`  | Worker | Yes      | [Open Charge Map key](https://openchargemap.org/site/develop/api) for imports |
| `BETTER_AUTH_SECRET`       | Worker | Yes      | Signs the session cookies; any long random value (`openssl rand -base64 32`)  |
| `GOOGLE_CLIENT_SECRET`     | Worker | No       | The development OAuth client's secret; without it there is no Google sign-in  |
| `GITHUB_CLIENT_ID`         | Worker | No       | The GitHub App's client ID, for Sign in with GitHub                           |
| `GITHUB_CLIENT_SECRET`     | Worker | No       | The GitHub App's client secret                                                |
| `MICROSOFT_CLIENT_SECRET`  | Worker | No       | The development Entra ID app's secret (its ID is in `wrangler.toml`)          |
| `IMPORT_BUDGET_MS`         | Worker | No       | Shortens each import run, e.g. locally                                        |

For local development, use a Google Maps key restricted to
`http://localhost:4321/*` and add
`http://localhost:4321/api/auth/callback/google` to the OAuth client's
authorized redirect URIs. `bun run dev` runs the Worker with `wrangler.toml`'s
`[env.local]`: the development OAuth client's ID, and the site's address
(`BETTER_AUTH_URL`, since requests reach the Worker through Astro's proxy).
See
[Deployment](DEPLOYMENT.md#google-cloud) for the full Google Cloud setup.

## Scripts

Run from the repository root:

| Script                    | Description                                   |
| ------------------------- | --------------------------------------------- |
| `bun run dev`             | Start the dev server and the Worker (API)     |
| `bun run dev:app`         | Start only the dev server                     |
| `bun run dev:worker`      | Start only the Worker                         |
| `bun run build`           | Build for production into `packages/app/dist` |
| `bun run export:chargers` | Export chargers for the country pages         |
| `bun run preview`         | Preview production build                      |
| `bun run test`            | Run Playwright tests                          |
| `bun run lint`            | Lint JS, CSS and Markdown                     |
| `bun run lint:md`         | Lint Markdown only                            |
| `bun run format`          | Format code                                   |
| `bun run format:check`    | Check formatting                              |
| `bun run format:md`       | Format Markdown only                          |
| `bun run format:md:check` | Check Markdown formatting only                |

## Tests

Before running tests for the first time, install the browser:

```bash
cd packages/app && bunx playwright install chromium
```

Tests replace Google Maps, the sign-in API and the charger API with local
fakes (`packages/app/tests/fixtures/`), so they need neither API keys nor
network access. Before writing tests, read the
[Testing Guidelines](TESTING_GUIDELINES.md).
