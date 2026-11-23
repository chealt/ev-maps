// The page's side of the charger index (./charger-index.js): every method
// returns a promise. It runs in a Web Worker (./charger-worker.js) when the
// browser can start one, and in the page otherwise, with the same answers.

import { ChargerIndex } from "./charger-index.js";

const startWorker = () => {
  try {
    return new Worker(new URL("./charger-worker.js", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
};

class ChargerIndexClient {
  nextId = 0;
  pending = new Map();

  constructor() {
    this.worker = startWorker();
    if (!this.worker) {
      this.local = new ChargerIndex();
      return;
    }
    this.worker.addEventListener("message", ({ data: { id, result, error } }) => {
      const call = this.pending.get(id);
      this.pending.delete(id);
      if (error) {
        call?.reject(new Error(error));
      } else {
        call?.resolve(result);
      }
    });
    // A worker that failed to load: answer from the page from then on, with
    // the chargers and filters it was given, and the calls still waiting.
    this.worker.addEventListener("error", () => {
      this.worker = null;
      this.local = new ChargerIndex();
      this.local.setChargers(this.chargers ?? []);
      if (this.filters) {
        this.local.filter(this.filters);
      }
      const waiting = [...this.pending.values()];
      this.pending.clear();
      for (const { method, args, resolve, reject } of waiting) {
        this.call(method, ...args).then(resolve, reject);
      }
    });
  }

  call(method, ...args) {
    if (!this.worker) {
      try {
        return Promise.resolve(this.local[method](...args));
      } catch (error) {
        return Promise.reject(error);
      }
    }
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, args, resolve, reject });
      this.worker.postMessage({ id, method, args });
    });
  }

  setChargers(chargers) {
    this.chargers = chargers;
    this.filters = null;
    return this.call("setChargers", chargers);
  }

  filter(filters) {
    this.filters = filters;
    return this.call("filter", filters);
  }

  clusters(box, zoom) {
    return this.call("clusters", box, zoom);
  }

  expansionZoom(clusterId) {
    return this.call("expansionZoom", clusterId);
  }

  clusterHas(clusterId, chargerIds) {
    return this.call("clusterHas", clusterId, chargerIds);
  }

  unclusteredZoom(charger, fromZoom) {
    return this.call("unclusteredZoom", { id: charger.id, location: charger.location }, fromZoom);
  }
}

export { ChargerIndexClient };
