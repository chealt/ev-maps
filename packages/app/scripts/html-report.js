// The tests of a Playwright HTML report (playwright-report/), as the report
// itself holds them: its index.html embeds a zip of JSON files, one per spec
// file, with each test's ID (for links into the report, #?testId=…), its
// results' annotations, and their attachments (files under data/).

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

const EMBEDDED_ZIP = /data:application\/zip;base64,([A-Za-z0-9+/=]+)/;

// The files of a zip, by name: enough for the report's (stored or deflated).
const unzip = (zip) => {
  const files = new Map();
  // The end of central directory record: where the directory starts.
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) {
    end--;
  }
  const count = zip.readUInt16LE(end + 10);
  let entry = zip.readUInt32LE(end + 16);
  for (let index = 0; index < count; index++) {
    const method = zip.readUInt16LE(entry + 10);
    const size = zip.readUInt32LE(entry + 20);
    const nameLength = zip.readUInt16LE(entry + 28);
    const extraLength = zip.readUInt16LE(entry + 30);
    const commentLength = zip.readUInt16LE(entry + 32);
    const local = zip.readUInt32LE(entry + 42);
    const name = zip.toString("utf8", entry + 46, entry + 46 + nameLength);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(data) : data);
    entry += 46 + nameLength + extraLength + commentLength;
  }
  return files;
};

// [{ testId, title, results: [{ annotations, attachments: [{ name, path }] }] }]
const reportTests = async (reportDir) => {
  const html = await readFile(join(reportDir, "index.html"), "utf8");
  const zip = EMBEDDED_ZIP.exec(html)?.[1];
  if (!zip) {
    return [];
  }
  const tests = [];
  for (const [name, data] of unzip(Buffer.from(zip, "base64"))) {
    if (!name.endsWith(".json") || name === "report.json") {
      continue;
    }
    for (const test of JSON.parse(data.toString("utf8")).tests ?? []) {
      tests.push({
        testId: test.testId,
        title: [...(test.path ?? []), test.title].filter(Boolean).join(" › "),
        annotations: test.annotations ?? [],
        results: test.results ?? [],
      });
    }
  }
  return tests;
};

export { reportTests, unzip };
