// Retries an operation that failed for a passing reason: remote D1 (through
// Wrangler's bindings, from CI) now and then answers "Network connection
// lost" or "D1 DB is overloaded", and a moment later it doesn't. Errors that
// won't pass by waiting (e.g. not authorized) fail at once.

const TRANSIENT =
  /network connection lost|overloaded|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|timed? ?out|\b(429|500|502|503|504)\b/i;

const isTransient = (error) =>
  [error, error?.cause].some((part) => TRANSIENT.test(`${part?.message ?? part ?? ""}`));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `operation()`, tried up to `attempts` times while it fails transiently,
// waiting baseMs, 2×, 4×… between tries (plus up to half again, so parallel
// readers don't retry in step).
const withRetries = async (
  operation,
  { attempts = 5, baseMs = 1000, wait = sleep, random = Math.random, onRetry = () => {} } = {}
) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts || !isTransient(error)) {
        throw error;
      }
      const delay = baseMs * 2 ** (attempt - 1) * (1 + random() / 2);
      onRetry(error, attempt, delay);
      await wait(delay);
    }
  }
};

export { isTransient, withRetries };
