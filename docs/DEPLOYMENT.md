# Deployment

## Cloudflare Workers

The app is served by the `ev-maps` Cloudflare Worker (`packages/worker`) as
static assets (`packages/worker/wrangler.toml` points at
`packages/app/dist/client`), and hands the server-rendered pages to Astro's
server in `packages/app/dist/server`.
The `Deploy` job in
`.github/workflows/app.yml` deploys it once lint, build and tests pass:

- **Pushes to `main`** deploy to production, which answers on two
  addresses: the custom domain `https://ev.chealt.com` (the main one) and
  `https://ev-maps.chealt.workers.dev`. Both are in `wrangler.toml`
  (`routes` and `workers_dev`), and everything below works on both: the
  Worker builds sign-in callback URLs from the address a request comes in on,
  so each provider lists both.
- **Every Monday**, `.github/workflows/refresh.yml` runs `app.yml` on `main`
  again, which rebuilds the country pages from the latest chargers and
  deploys them to production.
- **Pull requests** from this repository with the `deploy` label upload a
  preview version, without touching production; its URL
  (`https://<branch>-ev-maps.<subdomain>.workers.dev`) shows on the pull
  request. Adding the label deploys the pull request, and every push after
  that deploys again; without it, only the checks and tests run. Pull
  requests from forks are not deployed.
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

The admin area's data (errors, later usage stats) is in a second D1 database,
`ev-maps-admin` (binding `ADMIN_DB`, migrations in `admin-migrations/`),
created once with `bunx wrangler d1 create ev-maps-admin`; deploys apply its
migrations too.

CI's Playwright reports are in the R2 bucket `ev-maps-test-reports` (binding
`REPORTS`; see [Test reports](features/test-reports.md)), created once with a
rule deleting them after 30 days:

```bash
bunx wrangler r2 bucket create ev-maps-test-reports
bunx wrangler r2 bucket lifecycle add ev-maps-test-reports \
  delete-old-reports reports/ --expire-days 30
```

The Test job uploads them with an **R2 API token** (R2 → Manage API tokens →
Create, **Object Read & Write**, only this bucket): its Access Key ID and
Secret Access Key go into the `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`
secrets. It uses R2's S3 API, because a bucket-scoped R2 token isn't accepted
by Cloudflare's REST API. Recording the run uses `CLOUDFLARE_API_TOKEN` (its
**D1: Edit**).

The Worker needs these secrets, set once in Cloudflare:

```bash
cd packages/worker
bunx wrangler secret put OPEN_CHARGE_MAP_API_KEY
# Poland's register (EIPA): the token in the download links EIPA emails after
# registering at https://eipa.udt.gov.pl/reader/register
bunx wrangler secret put EIPA_TOKEN
# Signs the session cookies; any long random value, e.g. `openssl rand -base64 32`
bunx wrangler secret put BETTER_AUTH_SECRET
# The OAuth client's secret (see Google Cloud below)
bunx wrangler secret put GOOGLE_CLIENT_SECRET
# Optional: Sign in with GitHub (see GitHub below)
bunx wrangler secret put GITHUB_CLIENT_ID
bunx wrangler secret put GITHUB_CLIENT_SECRET
# Optional: Sign in with Microsoft (see Microsoft below)
bunx wrangler secret put MICROSOFT_CLIENT_SECRET
# Optional: Sign in with Apple (see Apple below)
bunx wrangler secret put APPLE_CLIENT_ID
bunx wrangler secret put APPLE_TEAM_ID
bunx wrangler secret put APPLE_KEY_ID
bunx wrangler secret put APPLE_PRIVATE_KEY < AuthKey_XXXXXXXXXX.p8
```

Sign-in runs in the Worker with [Better Auth](https://www.better-auth.com),
which keeps users and sessions in D1 (`/api/auth/*`, see
`packages/worker/src/auth.js`). The OAuth client IDs are public and set in
`wrangler.toml` (`GOOGLE_CLIENT_ID`): production's at the top level, the
development client's in `[env.local]`, which `bun run dev` uses.
Without `GOOGLE_CLIENT_SECRET` the Worker doesn't offer Google sign-in.

To deploy by hand:

```bash
bun run export:chargers -- --remote
bun run build
cd packages/worker
bunx wrangler d1 migrations apply ev-maps --remote
# --env= is the top level of wrangler.toml (production), not [env.local]
bunx wrangler deploy --env=
```

## EIPA (Poland)

Poland's official register of charging points, [EIPA](https://eipa.udt.gov.pl),
is free after registering an account with an email address; the confirmation
email has download links ending in a token, which is the Worker's
`EIPA_TOKEN`. The register limits static files to 10 downloads an hour and the
live file to 240; the Worker imports the static files weekly and the live file
every 5 minutes. EIPA deletes accounts that download nothing for 30 days, which
the weekly import prevents. Without the token, the Worker skips EIPA.

## IRVE (France)

France's national register of charging points is open data (Licence Ouverte
2.0), consolidated by transport.data.gouv.fr; it needs no account. The static
file lists every charging point (over 100 MB): the Worker streams it in 4
passes a week, each keeping a quarter of the stations, as all of them at once
wouldn't fit a Worker's memory. The live file (about 10 MB) is read every 15
minutes, which is plenty for a public service.

## Privacy, terms and crawlers

The privacy policy and terms of use are at `/{lang}/privacy/` and
`/{lang}/terms/` (`packages/app/src/legal/`). Use them on the Google OAuth
consent screen (Branding): `https://ev.chealt.com/en/privacy/` and
`https://ev.chealt.com/en/terms/`, with `https://ev.chealt.com` as the home
page.

The terms don't allow crawling, scraping or any use for AI. `robots.txt`
keeps known AI crawlers out entirely and every crawler out of `/api/`, pages
send `X-Robots-Tag: noai, noimageai` (`public/_headers`) and the API
`noindex, nofollow, noai, noimageai`. As robots.txt is only a request, also
turn on Cloudflare's **AI Crawl Control** (block AI bots) and **Bot Fight
Mode** for `chealt.com`, which enforce it.

The Worker enforces its part itself (`src/guard.js`): the API refuses bots,
asks for sign-in where needed and is rate limited per minute:

| API                                 | Who       | Limit              |
| ----------------------------------- | --------- | ------------------ |
| `/api/chargers/{z}/{x}/{y}` (tiles) | Everyone  | 600 per IP address |
| `/api/auth/*`, sign-in providers    | Everyone  | 60 per IP address  |
| Sending a sign-in email             | Everyone  | 5 per IP address   |
| `/api/admin/*`                      | Admins    | 120 per user       |
| `POST /api/errors`                  | Everyone  | 30 per IP address  |
| `POST /api/usage`                   | Everyone  | 60 per IP address  |
| `POST /api/telemetry`               | Everyone  | 60 per IP address  |
| `/api/chargers/status`              | Signed in | 120 per user       |
| `POST /api/chargers/route`          | Signed in | 20 per user        |
| `/api/settings`                     | Signed in | 60 per user        |
| `/api/favorites`                    | Signed in | 120 per user       |

## GitHub Secrets and Variables

Set these under **Settings → Secrets and variables → Actions**:

| Name                       | Type     | Purpose                                                                    |
| -------------------------- | -------- | -------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`     | Secret   | API token from the **Edit Cloudflare Workers** template, plus **D1: Edit** |
| `CLOUDFLARE_ACCOUNT_ID`    | Secret   | Cloudflare account ID (`bunx wrangler whoami` shows it)                    |
| `R2_ACCESS_KEY_ID`         | Secret   | The test reports bucket's R2 API token: its Access Key ID                  |
| `R2_SECRET_ACCESS_KEY`     | Secret   | The same token's Secret Access Key                                         |
| `VITE_GOOGLE_MAPS_API_KEY` | Secret   | Google Maps key, built into the page                                       |
| `VITE_GOOGLE_MAPS_MAP_ID`  | Variable | Map ID for the vector map                                                  |

The `Build` job fails if any of the `VITE_` ones is missing (except for pull
requests from forks, which don't get them).

## Google Cloud

- **APIs**: enable the **Maps JavaScript API**, **Places API (New)** (place
  suggestions in the route planner) and **Routes API** (planning the route).
  Google sign-in doesn't need an API, just the OAuth client (a **Web
  application** client).
- **Map ID**: create a **JavaScript, Vector** Map ID in Map Management, with
  tilt and rotation off.
- **API keys**: use separate keys for development and production, both
  restricted to those three APIs, with these website restrictions:
  - Production: `https://ev.chealt.com/*` and `https://*.chealt.workers.dev/*`
  - Development: `http://localhost:4321/*`
- **OAuth clients**: one for production and one for development, like the
  API keys. Add these **authorized redirect URIs** (wildcards aren't allowed):
  - Production: `https://ev.chealt.com/api/auth/callback/google`,
    `https://ev-maps.chealt.workers.dev/api/auth/callback/google` and
    `https://preview-ev-maps.chealt.workers.dev/api/auth/callback/google`.
    Its ID goes in `wrangler.toml`'s `[vars]`, its secret in the Worker's
    `GOOGLE_CLIENT_SECRET`.
  - Development: `http://localhost:4321/api/auth/callback/google`. Its ID goes
    in `wrangler.toml`'s `[env.local.vars]`, its secret in
    `packages/worker/.dev.vars` (`GOOGLE_CLIENT_SECRET`).

  The authorized JavaScript origins aren't needed any more: the page no longer
  signs in with Google's own button.

## GitHub

Sign in with GitHub uses a **GitHub App** (Settings → Developer settings →
GitHub Apps → New GitHub App), not an OAuth App: only a GitHub App takes more
than one callback URL.

- **Callback URLs**:
  - `https://ev.chealt.com/api/auth/callback/github`
  - `https://ev-maps.chealt.workers.dev/api/auth/callback/github`
  - `https://preview-ev-maps.chealt.workers.dev/api/auth/callback/github`
  - `http://localhost:4321/api/auth/callback/github`
- **Webhook**: off. **Permissions**: Account permissions → Email addresses →
  Read-only, so sign-in gets the user's email.
- Set its client ID and a generated client secret as the Worker's
  `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (and in `.dev.vars` locally).
  Without them, the menu doesn't offer GitHub.

## Microsoft

Sign in with Microsoft uses an app registration in
[Microsoft Entra ID](https://entra.microsoft.com) (App registrations → New
registration).

- **Supported account types**: accounts in any organizational directory and
  personal Microsoft accounts (the Worker uses the `common` tenant).
- **Two registrations**, like the Google OAuth clients: one for production and
  one for development. Their **Redirect URIs** (platform **Web**):
  - Production: `https://ev.chealt.com/api/auth/callback/microsoft`,
    `https://ev-maps.chealt.workers.dev/api/auth/callback/microsoft` and
    `https://preview-ev-maps.chealt.workers.dev/api/auth/callback/microsoft`
  - Development: `http://localhost:4321/api/auth/callback/microsoft`
- **Certificates & secrets**: add a client secret to each. Entra ID secrets
  expire (at most after two years), so note when to replace them.
- The **Application (client) ID** is public and goes in `wrangler.toml` as
  `MICROSOFT_CLIENT_ID`: production's in `[vars]`, development's in
  `[env.local.vars]`. The secret's **Value** goes in the Worker's
  `MICROSOFT_CLIENT_SECRET` (production) and in `.dev.vars` (development).
  Without both, the menu doesn't offer Microsoft.

## Apple

Sign in with Apple needs a paid [Apple Developer](https://developer.apple.com)
account. Apple only returns to HTTPS addresses, so it works on production and
the shared preview, not on `localhost`.

In Certificates, Identifiers & Profiles:

1. **App ID** (Identifiers → App IDs): with the **Sign in with Apple**
   capability.
2. **Services ID** (Identifiers → Services IDs), e.g.
   `com.chealt.evmaps.signin`: enable **Sign in with Apple**, with the App ID
   above as its primary App ID, and add:
   - **Domains**: `ev.chealt.com`, `ev-maps.chealt.workers.dev`,
     `preview-ev-maps.chealt.workers.dev`
   - **Return URLs**:
     `https://ev.chealt.com/api/auth/callback/apple`,
     `https://ev-maps.chealt.workers.dev/api/auth/callback/apple`,
     `https://preview-ev-maps.chealt.workers.dev/api/auth/callback/apple`
3. **Key** (Keys): enable **Sign in with Apple** for the App ID, and download
   the `.p8` file. Apple only lets you download it once.

Then set the Worker's secrets: `APPLE_CLIENT_ID` (the Services ID),
`APPLE_TEAM_ID` (top right of the developer portal), `APPLE_KEY_ID` (the
key's ID) and `APPLE_PRIVATE_KEY` (the `.p8` file's contents). Apple's client
secret is a JWT signed with that key, valid for at most six months; the Worker
signs a new one itself (`src/apple-client-secret.js`), so nothing expires. If
the key can't be used, the Worker logs why and leaves Apple out of the menu.

## Email and passkeys

Signing in with an email address sends a link with
[Resend](https://resend.com); opening it verifies the address and signs in
(the first time, it creates the account). Signed in, users can add a passkey
and sign in with it from then on. Only users with a verified email count as
signed in for the rest of the API.

1. In Resend, add and verify the domain `chealt.com` (it gives the DNS records
   to add in Cloudflare).
2. Create an API key with **Sending access**, and set it as the Worker's
   secret: `bunx wrangler secret put RESEND_API_KEY`.
3. The sender is `EMAIL_FROM` in `wrangler.toml` (`EV Maps
   <sign-in@chealt.com>`).

Without `RESEND_API_KEY` the Worker doesn't offer email sign-in, except
locally, where it logs the link instead (`bun run dev`'s output). Passkeys need
nothing to set up; each host (production, the workers.dev address, previews,
`localhost`) has its own passkeys.
