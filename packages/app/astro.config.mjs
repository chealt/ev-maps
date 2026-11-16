import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "astro/config";

// Lists the built files for the service worker to precache (public/sw.js).
// The HTML doesn't reference every file: scripts import shared chunks. Pages
// aren't listed: there's one per language and country, and the service worker
// caches the ones that are open.
const precacheManifest = () => ({
  name: "ev-maps:precache-manifest",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      const files = await readdir(new URL("_astro/", dir));
      const urls = ["/favicon.svg", ...files.map((file) => `/_astro/${file}`)];
      await writeFile(new URL("precache-manifest.json", dir), JSON.stringify(urls));
    },
  },
});

export default defineConfig({
  output: "static",
  devToolbar: {
    enabled: false,
  },
  integrations: [precacheManifest()],
  // Every page is under its language, e.g. /en/ and /en/hu/; see
  // src/pages/index.astro for /.
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: true },
  },
  vite: {
    resolve: {
      alias: {
        // The exported chargers the country pages are built from (see
        // src/lib/pages.js); the tests point it at their own fixtures.
        "@country-chargers": resolve(process.env.EV_MAPS_CHARGERS_DIR ?? "data/chargers"),
      },
    },
    // The API runs in the Worker, which `bun run dev` starts on port 8787.
    server: { proxy: { "/api": "http://localhost:8787" } },
  },
});
