// Bundling the Worker needs the app's build (packages/app/dist): its static
// files (client/) and its server-rendered pages (server/entry.mjs, imported by
// src/app-server.js). Where the app isn't built, e.g. the Worker's own CI
// checks or `bun run dev` before a build, this stands in for it: the static
// folder exists, and the server answers 503. A real build replaces both.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const APP_DIST = new URL("../../app/dist/", import.meta.url);
const SERVER_ENTRY = new URL("server/entry.mjs", APP_DIST);

mkdirSync(new URL("client/", APP_DIST), { recursive: true });
if (!existsSync(SERVER_ENTRY)) {
  mkdirSync(new URL("server/", APP_DIST), { recursive: true });
  writeFileSync(
    SERVER_ENTRY,
    `// A stand-in for the app's server (packages/worker/scripts/app-build-stub.js).
export default {
  fetch: () => new Response("The app isn't built: run bun run build.", { status: 503 }),
};
`
  );
  console.log("No app build: using a stand-in for its server.");
}
