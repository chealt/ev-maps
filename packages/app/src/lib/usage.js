// Usage stats for the admin area: the page counts events (e.g. a page view,
// a charger opened) for POST /api/usage. Only counts, nothing about who: no
// cookies, no identifiers.
//
// With a service worker, each count goes to it (./report-channel.js), and it
// batches and sends them for every tab. Without one, the page batches them
// itself and sends them every 30 seconds and when it's left.

import { pageKind } from "./page-kind.js";
import { onReportChannel, postReport } from "./report-channel.js";

const USAGE_URL = "/api/usage";
const SEND_EVERY_MS = 30 * 1000;

// { [event]: { [dimension]: count } }, kept while there's no service worker.
let pending = {};
let timer = null;

const track = (event, dimension = "") => {
  if (postReport("usage", { [event]: { [dimension]: 1 } })) {
    return;
  }
  pending[event] ??= {};
  pending[event][dimension] = (pending[event][dimension] ?? 0) + 1;
};

const send = () => {
  if (Object.keys(pending).length === 0) {
    return;
  }
  const events = pending;
  pending = {};
  if (postReport("usage", events)) {
    return;
  }
  // keepalive: sent even while the page is being left.
  fetch(USAGE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events }),
    keepalive: true,
  }).catch(() => {});
};

// A setting the device keeps, if it's one of `values`, or `fallback`.
const storedPreference = (key, values, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return values.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

const sendWhenHidden = () => {
  if (document.visibilityState === "hidden") {
    send();
  }
};

const kind = pageKind(window.location.pathname);
if (kind) {
  track("page_view", `${document.documentElement.lang}:${kind}`);
  track("page_path", window.location.pathname);
  // The device's own settings, for the admins' Usage pages (#373): the theme
  // and whether it animates ("reduced" when the system asks for less).
  track("preference", `theme:${storedPreference("ev-maps:theme", ["light", "dark"], "system")}`);
  track(
    "preference",
    `animations:${
      matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "reduced"
        : storedPreference("ev-maps:animations", ["off"], "on")
    }`
  );
}
timer = setInterval(send, SEND_EVERY_MS);
window.addEventListener("pagehide", send);
document.addEventListener("visibilitychange", sendWhenHidden);

// Once a service worker controls the page, it does the sending.
onReportChannel(() => {
  clearInterval(timer);
  window.removeEventListener("pagehide", send);
  document.removeEventListener("visibilitychange", sendWhenHidden);
  send();
});

export { send, track };
