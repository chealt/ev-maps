// The page's chargers, filtered and clustered off the main thread
// (./charger-index.js). Each message is { id, method, args }; the answer is
// { id, result } or { id, error }. Messages are handled in order, so a
// query after a filter change sees the new index.

import { ChargerIndex } from "./charger-index.js";

const index = new ChargerIndex();
const METHODS = new Set([
  "setChargers",
  "filter",
  "clusters",
  "expansionZoom",
  "clusterHas",
  "unclusteredZoom",
]);

self.addEventListener("message", ({ data: { id, method, args } }) => {
  if (!METHODS.has(method)) {
    self.postMessage({ id, error: `Unknown method: ${method}` });
    return;
  }
  try {
    self.postMessage({ id, result: index[method](...args) });
  } catch (error) {
    self.postMessage({ id, error: String(error?.message ?? error) });
  }
});
