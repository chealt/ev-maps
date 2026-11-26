import { beforeEach, describe, expect, test } from "bun:test";
import { MIRROR_COOLDOWN_MS, QUICK_FAILURE_MS, overpassClient } from "./overpass-client.js";

const first = "https://one.example/api/interpreter";
const second = "https://two.example/api/interpreter";
const third = "https://three.example/api/interpreter";

let asked;
// Each mirror's answer: a status, or a thrown error (a timeout).
let answers;
let time;
let slept;
let fetchOverpass;

beforeEach(() => {
  asked = [];
  answers = {};
  time = 0;
  slept = [];
  fetchOverpass = overpassClient({
    urls: [first, second, third],
    timeoutMs: 1000,
    now: () => time,
    sleep: async (ms) => {
      slept.push(ms);
    },
    fetchImpl: async (url) => {
      asked.push(url);
      // A list: one answer per time asked.
      const queued = answers[url];
      const answer = (Array.isArray(queued) ? queued.shift() : queued) ?? 200;
      if (answer?.slow) {
        time += QUICK_FAILURE_MS;
        return new Response("", { status: answer.slow });
      }
      if (answer instanceof Error) {
        throw answer;
      }
      return new Response(JSON.stringify({ elements: [{ type: "node", id: 1 }] }), {
        status: answer,
      });
    },
  });
});

describe("overpassClient", () => {
  test("asks the mirrors in order until one answers", async () => {
    answers = { [first]: { slow: 502 } };
    expect(await fetchOverpass("q")).toEqual([{ type: "node", id: 1 }]);
    expect(asked).toEqual([first, second]);
  });

  test("asks a mirror that just failed last, so a slow one doesn't hold up every query", async () => {
    answers = { [first]: { slow: 502 }, [second]: new Error("The operation timed out.") };
    await fetchOverpass("q");
    expect(asked).toEqual([first, second, third]);

    asked = [];
    await fetchOverpass("q");
    expect(asked).toEqual([third]);

    // After the cooldown, they're asked first again.
    time += MIRROR_COOLDOWN_MS;
    answers = {};
    asked = [];
    await fetchOverpass("q");
    expect(asked).toEqual([first]);
  });

  test("still tries the failed mirrors when none is healthy, and says how each failed", async () => {
    answers = {
      [first]: { slow: 502 },
      [second]: { slow: 504 },
      [third]: new Error("The operation timed out."),
    };
    await expect(fetchOverpass("q")).rejects.toThrow(
      "Overpass failed: one.example: 502; two.example: 504; three.example: The operation timed out."
    );

    asked = [];
    answers = { [first]: { slow: 502 } };
    await fetchOverpass("q");
    // The soonest back first: the order they failed in.
    expect(asked).toEqual([first, second]);
  });

  test("asks a mirror that refused at once again, after a moment, before the next one", async () => {
    answers = { [first]: [504, 200] };
    expect(await fetchOverpass("q")).toEqual([{ type: "node", id: 1 }]);
    expect(asked).toEqual([first, first]);
    expect(slept).toEqual([2000]);

    // Refusing again: on to the next mirror, the first one cooling down.
    asked = [];
    answers = { [first]: [504, 504] };
    await fetchOverpass("q");
    expect(asked).toEqual([first, first, second]);
  });

  test("doesn't ask a mirror again that took its time to fail", async () => {
    answers = { [first]: { slow: 504 } };
    await fetchOverpass("q");
    expect(asked).toEqual([first, second]);
    expect(slept).toEqual([]);
  });
});
