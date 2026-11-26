// An Overpass client over the given mirrors. A mirror that just failed
// (refused, overloaded, timed out) is asked last for MIRROR_COOLDOWN_MS: an
// overloaded one can take minutes to fail, on every query, while another
// answers in seconds (#270). `fetchImpl` and `now` are for tests.

const MIRROR_COOLDOWN_MS = 15 * 60 * 1000;
// A mirror that refuses at once (a 5xx within this) is often only busy for
// a moment: asked again once, after RETRY_DELAY_MS, before the next mirror.
const QUICK_FAILURE_MS = 5000;
const RETRY_DELAY_MS = 2000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const overpassClient = ({ urls, timeoutMs, fetchImpl = fetch, now = Date.now, sleep = wait }) => {
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

  // One mirror's answer: the elements, or an error message.
  const ask = async (url, overpassQuery) => {
    const started = now();
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        body: new URLSearchParams({ data: overpassQuery }),
        headers: { "user-agent": "ev-maps importer (https://ev.chealt.com)" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) {
        return { elements: (await response.json()).elements ?? [] };
      }
      return {
        error: `${new URL(url).host}: ${response.status}`,
        quick: response.status >= 500 && now() - started < QUICK_FAILURE_MS,
      };
    } catch (error) {
      return { error: `${new URL(url).host}: ${error.message}` };
    }
  };

  const fetchOverpass = async (overpassQuery) => {
    const errors = [];
    for (const url of mirrorOrder()) {
      let answer = await ask(url, overpassQuery);
      if (answer.quick) {
        await sleep(RETRY_DELAY_MS);
        answer = await ask(url, overpassQuery);
      }
      if (answer.elements) {
        downUntil.delete(url);
        return answer.elements;
      }
      errors.push(answer.error);
      downUntil.set(url, now() + MIRROR_COOLDOWN_MS);
    }
    throw new Error(`Overpass failed: ${errors.join("; ")}`);
  };

  return fetchOverpass;
};

export { MIRROR_COOLDOWN_MS, QUICK_FAILURE_MS, overpassClient };
