# Deployment

## Cloudflare Workers

The app is served by the `ev-maps` Cloudflare Worker (`packages/worker`) as
static assets (`packages/worker/wrangler.toml` points at `packages/app/dist`).
The `Deploy` job in
`.github/workflows/app.yml` deploys it once lint, build and tests pass:

- **Pushes to `main`** deploy to production at
  `https://ev-maps.<your-subdomain>.workers.dev`.
- **Every Monday**, `.github/workflows/refresh.yml` runs `app.yml` on `main`
  again, which rebuilds the country pages from the latest chargers and
  deploys them to production.
- **Pull requests** from this repository upload a preview version, without
  touching production; its URL (`https://<branch>-ev-maps.<subdomain>.workers.dev`)
  shows on the pull request. Pull requests from forks are not deployed.
- **The shared preview**, `https://preview-ev-maps.<subdomain>.workers.dev`,
  always shows the most recently deployed pull request. Google sign-in only
  returns to authorized redirect URIs, which can't contain wildcards, so this
  is the one preview address to add to the OAuth client.

It deploys the `ev-maps-dist` artifact from the `Build` job, so the app is
built in GitHub Actions, not by Cloudflare.

The `Build` job exports the chargers from the production D1 database for the
country pages, so it needs the Cloudflare secrets too. The export reads D1
through a Wrangler remote binding (`packages/worker/wrangler.export.toml`,
which is never deployed), so the token needs
**Workers Scripts: Edit** (in the Workers template) as well as D1.

The Worker also serves `/api/chargers/…` and the redirect for `/`, and imports
chargers into the `ev-maps` D1 database on a schedule (see
[Architecture](ARCHITECTURE.md)). Pushes to `main` apply new database
migrations before deploying; pull request previews share the database and
never change its schema.

The Worker needs these secrets, set once in Cloudflare:

```bash
cd packages/worker
bunx wrangler secret put OPEN_CHARGE_MAP_API_KEY
# Signs the session cookies; any long random value, e.g. `openssl rand -base64 32`
bunx wrangler secret put BETTER_AUTH_SECRET
# The OAuth client's secret (see Google Cloud below)
bunx wrangler secret put GOOGLE_CLIENT_SECRET
# Optional: Sign in with GitHub (see GitHub below)
bunx wrangler secret put GITHUB_CLIENT_ID
bunx wrangler secret put GITHUB_CLIENT_SECRET
```

Sign-in runs in the Worker with [Better Auth](https://www.better-auth.com),
which keeps users and sessions in D1 (`/api/auth/*`, see
`packages/worker/src/auth.js`). The production OAuth client's ID is public
and set in `wrangler.toml` (`GOOGLE_CLIENT_ID`); local development uses a
separate client, whose ID and secret go in `.dev.vars`, which overrides it. Without `GOOGLE_CLIENT_SECRET` the
Worker offers no Google sign-in, and the page says sign-in failed.

To deploy by hand:

```bash
bun run export:chargers -- --remote
bun run build
cd packages/worker
bunx wrangler d1 migrations apply ev-maps --remote
bunx wrangler deploy
```

## GitHub Secrets and Variables

Set these under **Settings → Secrets and variables → Actions**:

| Name                       | Type     | Purpose                                                                    |
| -------------------------- | -------- | -------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`     | Secret   | API token from the **Edit Cloudflare Workers** template, plus **D1: Edit** |
| `CLOUDFLARE_ACCOUNT_ID`    | Secret   | Cloudflare account ID (`bunx wrangler whoami` shows it)                    |
| `VITE_GOOGLE_MAPS_API_KEY` | Secret   | Google Maps key, built into the page                                       |
| `VITE_GOOGLE_MAPS_MAP_ID`  | Variable | Map ID for the vector map                                                  |

The `Build` job fails if any of the `VITE_` ones is missing (except for pull
requests from forks, which don't get them).

## Google Cloud

- **APIs**: enable only the **Maps JavaScript API**. Google sign-in doesn't
  need an API, just the OAuth client (a **Web application** client).
- **Map ID**: create a **JavaScript, Vector** Map ID in Map Management, with
  tilt and rotation off.
- **API keys**: use separate keys for development and production, both
  restricted to the Maps JavaScript API, with these website restrictions:
  - Production: `https://*.chealt.workers.dev/*`
  - Development: `http://localhost:4321/*`
- **OAuth clients**: one for production and one for development, like the
  API keys. Add these **authorized redirect URIs** (wildcards aren't allowed):
  - Production: `https://ev-maps.chealt.workers.dev/api/auth/callback/google`
    and `https://preview-ev-maps.chealt.workers.dev/api/auth/callback/google`.
    Its ID goes in `wrangler.toml`, its secret in the Worker's
    `GOOGLE_CLIENT_SECRET`.
  - Development: `http://localhost:4321/api/auth/callback/google`. Its ID and
    secret go in `packages/worker/.dev.vars` (`GOOGLE_CLIENT_ID`,
    `GOOGLE_CLIENT_SECRET`).

  The authorized JavaScript origins aren't needed any more: the page no longer
  signs in with Google's own button.

## GitHub

Sign in with GitHub uses a **GitHub App** (Settings → Developer settings →
GitHub Apps → New GitHub App), not an OAuth App: only a GitHub App takes more
than one callback URL.

- **Callback URLs**:
  - `https://ev-maps.chealt.workers.dev/api/auth/callback/github`
  - `https://preview-ev-maps.chealt.workers.dev/api/auth/callback/github`
  - `http://localhost:4321/api/auth/callback/github`
- **Webhook**: off. **Permissions**: Account permissions → Email addresses →
  Read-only, so sign-in gets the user's email.
- Set its client ID and a generated client secret as the Worker's
  `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (and in `.dev.vars` locally).
  Without them, the menu doesn't offer GitHub.
