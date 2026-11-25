import { beforeEach, describe, expect, test } from "bun:test";
import { MIRROR_COOLDOWN_MS, overpassClient } from "./overpass-client.js";

const first = "https://one.example/api/interpreter";
const second = "https://two.example/api/interpreter";
const third = "https://three.example/api/interpreter";

let asked;
// Each mirror's answer: a status, or a thrown error (a timeout).
let answers;
let time;
let fetchOverpass;

beforeEach(() => {
  asked = [];
  answers = {};
  time = 0;
  fetchOverpass = overpassClient({
    urls: [first, second, third],
    timeoutMs: 1000,
    now: () => time,
    fetchImpl: async (url) => {
      asked.push(url);
      const answer = answers[url] ?? 200;
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
    answers = { [first]: 502 };
    expect(await fetchOverpass("q")).toEqual([{ type: "node", id: 1 }]);
    expect(asked).toEqual([first, second]);
  });

  test("asks a mirror that just failed last, so a slow one doesn't hold up every query", async () => {
    answers = { [first]: 502, [second]: new Error("The operation timed out.") };
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
    answers = { [first]: 502, [second]: 504, [third]: new Error("The operation timed out.") };
    await expect(fetchOverpass("q")).rejects.toThrow(
      "Overpass failed: one.example: 502; two.example: 504; three.example: The operation timed out."
    );

    asked = [];
    answers = { [first]: 502 };
    await fetchOverpass("q");
    // The soonest back first: the order they failed in.
    expect(asked).toEqual([first, second]);
  });
});
