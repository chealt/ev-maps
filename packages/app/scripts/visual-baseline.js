// The baselines of the @ui tests' visual comparison (#309, docs/CI.md): the
// screenshots captureUi matches with Playwright's toHaveScreenshot, from
// main's last run, in the reports bucket under reports/ui-baseline/main/.
//
//   bun scripts/visual-baseline.js download   (a pull request's shard, first)
//   bun scripts/visual-baseline.js upload     (a main shard, after its tests)
//
// From the environment: report-storage.js's R2 settings.

import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { file as bunFile } from "bun";
import { filesIn, reportBucket } from "./report-storage.js";

const DIR = "visual-baseline";
const PREFIX = "reports/ui-baseline/main/";

const keysUnder = async (bucket, prefix) => {
  const keys = [];
  let startAfter;
  for (;;) {
    const page = await bucket.list({ prefix, startAfter, maxKeys: 1000 });
    const found = (page.contents ?? []).map(({ key }) => key);
    keys.push(...found);
    if (!page.isTruncated || !found.length) {
      return keys;
    }
    startAfter = found.at(-1);
  }
};

const download = async () => {
  const bucket = reportBucket();
  await mkdir(DIR, { recursive: true });
  const keys = await keysUnder(bucket, PREFIX);
  await Promise.all(
    keys.map(async (key) =>
      writeFile(join(DIR, basename(key)), new Uint8Array(await bucket.file(key).arrayBuffer()))
    )
  );
  console.log(`Downloaded main's ${keys.length} baseline screenshots.`);
};

// Each shard uploads the ones its tests wrote; together, every @ui moment.
const upload = async () => {
  const bucket = reportBucket();
  const files = await filesIn(DIR).catch(() => []);
  await Promise.all(files.map((file) => bucket.write(`${PREFIX}${basename(file)}`, bunFile(file))));
  console.log(`Uploaded ${files.length} baseline screenshots.`);
};

const commands = { download, upload };
const command = commands[process.argv[2]];
if (!command) {
  console.error("Usage: bun scripts/visual-baseline.js download|upload");
  process.exit(1);
}
await command();
