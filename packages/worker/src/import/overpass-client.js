// An Overpass client over the given mirrors. A mirror that just failed
// (refused, overloaded, timed out) is asked last for MIRROR_COOLDOWN_MS: an
// overloaded one can take minutes to fail, on every query, while another
// answers in seconds (#270). `fetchImpl` and `now` are for tests.

const MIRROR_COOLDOWN_MS = 15 * 60 * 1000;

const overpassClient = ({ urls, timeoutMs, fetchImpl = fetch, now = Date.now }) => {
  // When each mirror may be asked first again; kept between the queries of a
  // run (and of runs on the same isolate).
  const downUntil = new Map();

  // The mirrors to ask, in order: the healthy ones as listed, then those
  // cooling down, soonest back first, in case none is healthy.
  const mirrorOrder = () => {
    const down = (url) => (downUntil.get(url) ?? 0) > now();
    return [
      ...urls.filter((url) => !down(url)),
      ...urls.filter(down).sort((a, b) => downUntil.get(a) - downUntil.get(b)),
    ];
  };

  const fetchOverpass = async (overpassQuery) => {
    const errors = [];
    for (const url of mirrorOrder()) {
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          body: new URLSearchParams({ data: overpassQuery }),
          headers: { "user-agent": "ev-maps importer (https://ev.chealt.com)" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.ok) {
          downUntil.delete(url);
          return (await response.json()).elements ?? [];
        }
        errors.push(`${new URL(url).host}: ${response.status}`);
      } catch (error) {
        errors.push(`${new URL(url).host}: ${error.message}`);
      }
      downUntil.set(url, now() + MIRROR_COOLDOWN_MS);
    }
    throw new Error(`Overpass failed: ${errors.join("; ")}`);
  };

  return fetchOverpass;
};

export { MIRROR_COOLDOWN_MS, overpassClient };
