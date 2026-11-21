import { describe, expect, test } from "bun:test";
import { csvRows } from "./csv.js";

// The text in chunks, split wherever the test likes, as a network stream is.
const streamOf = (...chunks) =>
  new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });

const rowsOf = async (...chunks) => {
  const rows = [];
  for await (const row of csvRows(streamOf(...chunks))) {
    rows.push(row);
  }
  return rows;
};

describe("csvRows", () => {
  test("reads rows as objects by the header's names", async () => {
    expect(await rowsOf("a,b\n1,2\n3,4\n")).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  test("reads quoted fields with commas, quotes and line breaks", async () => {
    expect(await rowsOf('name,note\n"Paris, 8e","He said ""hi""\nthen left"\n')).toEqual([
      { name: "Paris, 8e", note: 'He said "hi"\nthen left' },
    ]);
  });

  test("reads rows split across chunks anywhere, even inside quotes", async () => {
    expect(await rowsOf('a,b\n"x,', 'y""z",2\r', "\n3,4")).toEqual([
      { a: 'x,y"z', b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  test("ignores a byte order mark and blank lines", async () => {
    expect(await rowsOf("\uFEFFid,v\n1,a\n\n2,b\n")).toEqual([
      { id: "1", v: "a" },
      { id: "2", v: "b" },
    ]);
  });
});
