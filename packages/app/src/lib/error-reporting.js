// Reports the page's uncaught errors and rejected promises to the Worker
// (POST /api/errors), for the admin area: at most a few per page, each once,
// and not the ones browser extensions or other sites' scripts cause. With a
// service worker, it sends them (./report-channel.js), and keeps the ones it
// can't send yet; without one, the page sends them itself.

import { postReport } from "./report-channel.js";

const ERRORS_URL = "/api/errors";
const MAX_REPORTS = 10;
const reported = new Set();

// Errors that aren't the page's: extensions' scripts, and cross-origin
// scripts, whose errors the browser hides as "Script error.".
const isForeign = ({ message, stack }) =>
  message === "Script error." || /(chrome|moz|safari(-web)?)-extension:\/\//.test(stack ?? "");

const report = (error) => {
  const details = {
    name: error?.name ?? "Error",
    message: String(error?.message ?? error ?? "Unknown error"),
    stack: error?.stack ?? "",
    url: window.location.href,
  };
  const key = `${details.name}|${details.message}|${details.stack.split("\n")[1] ?? ""}`;
  if (isForeign(details) || reported.has(key) || reported.size >= MAX_REPORTS) {
    return;
  }
  reported.add(key);
  if (postReport("error", details)) {
    return;
  }
  // keepalive: the report survives the page being closed.
  fetch(ERRORS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(details),
    keepalive: true,
  }).catch(() => {});
};

window.addEventListener("error", (event) =>
  report(event.error ?? { name: "Error", message: event.message, stack: "" })
);
window.addEventListener("unhandledrejection", (event) => report(event.reason));

export { report };
