# Deployment

## Cloudflare Workers

The app is served by the `ev-maps` Cloudflare Worker as static assets
(`packages/app/wrangler.toml`). The `Deploy` job in
`.github/workflows/app.yml` deploys it once lint, build and tests pass:

- **Pushes to `main`** deploy to production at
  `https://ev-maps.<your-subdomain>.workers.dev`.
- **Pull requests** from this repository upload a preview version, without
  touching production; its URL (`https://<branch>-ev-maps.<subdomain>.workers.dev`)
  shows on the pull request. Pull requests from forks are not deployed.
- **The shared preview**, `https://preview-ev-maps.<subdomain>.workers.dev`,
  always shows the most recently deployed pull request. Google sign-in only
  works on authorized origins, which can't contain wildcards, so this is the
  one preview address to add to the OAuth client.

It deploys the `ev-maps-dist` artifact from the `Build` job, so the app is
built in GitHub Actions, not by Cloudflare.

To deploy by hand:

```bash
bun run build
cd packages/app && bunx wrangler deploy
```

## GitHub Secrets and Variables

Set these under **Settings → Secrets and variables → Actions**:

| Name                           | Type     | Purpose                                                 |
| ------------------------------ | -------- | ------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`         | Secret   | API token from the **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID`        | Secret   | Cloudflare account ID (`bunx wrangler whoami` shows it) |
| `VITE_GOOGLE_MAPS_API_KEY`     | Secret   | Google Maps key, built into the page                    |
| `VITE_OPEN_CHARGE_MAP_API_KEY` | Secret   | Open Charge Map key, built into the page                |
| `VITE_GOOGLE_MAPS_MAP_ID`      | Variable | Map ID for the vector map                               |
| `VITE_GOOGLE_CLIENT_ID`        | Variable | OAuth client ID for Google sign-in                      |

The `Build` job fails if any of the `VITE_` ones is missing (except for pull
requests from forks, which don't get them).

## Google Cloud

- **APIs**: enable only the **Maps JavaScript API**. Google sign-in doesn't
  need an API, just the OAuth client.
- **Map ID**: create a **JavaScript, Vector** Map ID in Map Management, with
  tilt and rotation off.
- **API keys**: use separate keys for development and production, both
  restricted to the Maps JavaScript API, with these website restrictions:
  - Production: `https://*.chealt.workers.dev/*`
  - Development: `http://localhost:4321/*`
- **OAuth client**: add these **authorized JavaScript origins** (no redirect
  URIs are needed, and wildcards aren't allowed):
  - `https://ev-maps.chealt.workers.dev`
  - `https://preview-ev-maps.chealt.workers.dev`
  - `http://localhost:4321`
