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
   API keys:

   ```bash
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   VITE_OPEN_CHARGE_MAP_API_KEY=your_api_key_here
   ```

   See [Environment Variables](#environment-variables) for what each one is
   and where to get it.

3. Start the development server at `http://localhost:4321/`:

   ```bash
   bun run dev
   ```

## Environment Variables

All of them are built into the page, so none of them is secret once deployed.

| Name                           | Required | Purpose                                                           |
| ------------------------------ | -------- | ----------------------------------------------------------------- |
| `VITE_GOOGLE_MAPS_API_KEY`     | Yes      | Google Maps key with the **Maps JavaScript API** enabled          |
| `VITE_OPEN_CHARGE_MAP_API_KEY` | Yes      | [Open Charge Map key](https://openchargemap.org/site/develop/api) |
| `VITE_GOOGLE_MAPS_MAP_ID`      | No       | Map ID for advanced markers (defaults to Google's `DEMO_MAP_ID`)  |
| `VITE_GOOGLE_CLIENT_ID`        | No       | OAuth client ID; without it there is no Google sign-in            |

For local development, use a Google Maps key restricted to
`http://localhost:4321/*` and add `http://localhost:4321` to the OAuth
client's authorized JavaScript origins. See
[Deployment](DEPLOYMENT.md#google-cloud) for the full Google Cloud setup.

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

## Tests

Before running tests for the first time, install the browser:

```bash
cd packages/app && bunx playwright install chromium
```

Tests replace Google Maps, Google sign-in and Open Charge Map with local
fakes (`packages/app/tests/fixtures/`), so they need neither API keys nor
network access. Before writing tests, read the
[Testing Guidelines](TESTING_GUIDELINES.md).
