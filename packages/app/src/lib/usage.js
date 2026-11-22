// Usage stats for the admin area: the page counts events (e.g. a page view,
// a charger opened) and sends the counts, batched, to POST /api/usage every
// 30 seconds and when the page is left. Only counts, nothing about who: no
// cookies, no identifiers.

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

// The kind of page, by its path: /en/ (home), /en/hu/ (country), /en/privacy/
// (legal); the admin area isn't counted.
const pageKind = (pathname) => {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[1] === "admin") {
    return null;
  }
  if (parts.length === 1) {
    return "home";
  }
  return ["privacy", "terms"].includes(parts[1]) ? "legal" : "country";
};

const kind = pageKind(window.location.pathname);
if (kind) {
  track("page_view", `${document.documentElement.lang}:${kind}`);
}
setInterval(send, SEND_EVERY_MS);
window.addEventListener("pagehide", send);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    send();
  }
});

export { pageKind, send, track };
