import { readdir, writeFile } from "node:fs/promises";
import { defineConfig } from "astro/config";

// Lists the built page and files for the service worker to precache
// (public/sw.js). The HTML doesn't reference every file: scripts import
// shared chunks.
const precacheManifest = () => ({
  name: "ev-maps:precache-manifest",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      const files = await readdir(new URL("_astro/", dir));
      const urls = ["/", "/favicon.svg", ...files.map((file) => `/_astro/${file}`)];
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
});
