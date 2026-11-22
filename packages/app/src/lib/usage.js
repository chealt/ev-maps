// Usage stats for the admin area: the page counts events (e.g. a page view,
// a charger opened) and sends the counts, batched, to POST /api/usage every
// 30 seconds and when the page is left. Only counts, nothing about who: no
// cookies, no identifiers.

import { pageKind } from "./page-kind.js";

const USAGE_URL = "/api/usage";
const SEND_EVERY_MS = 30 * 1000;

// { [event]: { [dimension]: count } }
let pending = {};

const track = (event, dimension = "") => {
  pending[event] ??= {};
  pending[event][dimension] = (pending[event][dimension] ?? 0) + 1;
};

const send = () => {
  if (Object.keys(pending).length === 0) {
    return;
  }
  const body = JSON.stringify({ events: pending });
  pending = {};
  // keepalive: sent even while the page is being left.
  fetch(USAGE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
};

const kind = pageKind(window.location.pathname);
if (kind) {
  track("page_view", `${document.documentElement.lang}:${kind}`);
  track("page_path", window.location.pathname);
}
setInterval(send, SEND_EVERY_MS);
window.addEventListener("pagehide", send);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    send();
  }
});

export { send, track };
