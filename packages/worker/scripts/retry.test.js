import { describe, expect, test } from "bun:test";
import { isTransient, withRetries } from "./retry.js";

const failing = (errors, result = "rows") => {
  let calls = 0;
  const operation = async () => {
    const error = errors[calls++];
    if (error) {
      throw error;
    }
    return result;
  };
  operation.calls = () => calls;
  return operation;
};

const noWait = { wait: async () => {}, random: () => 0 };

describe("isTransient", () => {
  test("knows the errors remote D1 gives in passing", () => {
    for (const message of [
      "D1_ERROR: Failed to parse body as JSON, got: Error: Network connection lost.",
      "D1_ERROR: D1 DB is overloaded. Requests queued for too long.",
      "fetch failed",
      "read ECONNRESET",
    ]) {
      expect(isTransient(new Error(message))).toBe(true);
    }
    expect(isTransient(new Error("D1", { cause: new Error("socket hang up") }))).toBe(true);
  });

  test("not the ones that waiting won't fix", () => {
    for (const message of ["Not authorized [code: 10000]", "no such table: chargers"]) {
      expect(isTransient(new Error(message))).toBe(false);
    }
  });
});

describe("withRetries", () => {
  test("tries again after transient errors, waiting longer each time", async () => {
    const waits = [];
    const operation = failing([
      new Error("Network connection lost"),
      new Error("D1 DB is overloaded"),
    ]);
    const result = await withRetries(operation, {
      baseMs: 100,
      random: () => 0,
      wait: async (ms) => waits.push(ms),
    });
    expect(result).toBe("rows");
    expect(operation.calls()).toBe(3);
    expect(waits).toEqual([100, 200]);
  });

  test("gives up after the last attempt", async () => {
    const operation = failing(
      Array.from({ length: 5 }, () => new Error("Network connection lost"))
    );
    await expect(withRetries(operation, { attempts: 3, ...noWait })).rejects.toThrow(
      "Network connection lost"
    );
    expect(operation.calls()).toBe(3);
  });

  test("fails at once for errors waiting won't fix", async () => {
    const operation = failing([new Error("Not authorized [code: 10000]")]);
    await expect(withRetries(operation, noWait)).rejects.toThrow("Not authorized");
    expect(operation.calls()).toBe(1);
  });
});
