// Hands the page's reports (usage counts, performance spans and Web Vitals,
// errors) to the service worker, which batches them for every tab, sends
// them, and keeps what it couldn't send (public/sw.js). Without one (the
// first visit, or a browser that blocks it), the callers send them
// themselves, as before.

const controller = () => navigator.serviceWorker?.controller ?? null;

// Whether a service worker took the report: { kind, payload }, kind being
// "usage" ({ [event]: { [dimension]: count } }), "span", "vital" or "error".
const postReport = (kind, payload) => {
  const worker = controller();
  if (!worker) {
    return false;
  }
  worker.postMessage({ type: "report", kind, payload });
  return true;
};

// Calls `callback` once a service worker starts controlling the page (e.g.
// on the first visit, after it installs), so callers can hand it what they
// were keeping and stop their own timers.
const onReportChannel = (callback) => {
  if (controller()) {
    callback();
    return;
  }
  navigator.serviceWorker?.addEventListener("controllerchange", () => callback(), {
    once: true,
  });
};

export { onReportChannel, postReport };
