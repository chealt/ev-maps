// The baselines of the @ui tests' visual comparison (#309, docs/CI.md): the
// screenshots captureUi matches with Playwright's toHaveScreenshot, per main
// commit, in the reports bucket under reports/ui-baseline/{sha}/. A pull
// request compares with the main commit it's tested on, not main's last run,
// which can be older or newer (#395).
//
//   bun scripts/visual-baseline.js download {sha} {shards}
//     (a pull request's shard, first: writes found=true or found=false to
//     $GITHUB_OUTPUT; false while not every one of the commit's shards has
//     uploaded, e.g. its run hasn't finished or was skipped)
//   bun scripts/visual-baseline.js upload {sha} {shard}
//     (a main shard, after its tests)
//
// From the environment: report-storage.js's R2 settings.

import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { file as bunFile } from "bun";
import { filesIn, reportBucket } from "./report-storage.js";

const DIR = "visual-baseline";
const PREFIX = "reports/ui-baseline/";
const SHA = /^[0-9a-f]{40}$/;

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

const commitPrefix = (sha) => {
  if (!SHA.test(sha ?? "")) {
    throw new Error(`Not a commit: ${sha}`);
  }
  return `${PREFIX}${sha}/`;
};

// A shard's marker, uploaded after its screenshots: the commit's baselines
// are complete when every shard's is there.
const markerKey = (prefix, shard) => `${prefix}shards/${shard}`;

const output = (line) =>
  process.env.GITHUB_OUTPUT ? appendFile(process.env.GITHUB_OUTPUT, `${line}\n`) : null;

const download = async (sha, shards) => {
  const bucket = reportBucket();
  const prefix = commitPrefix(sha);
  const keys = await keysUnder(bucket, prefix);
  const total = Number(shards);
  const complete = Array.from({ length: total }, (_, index) =>
    keys.includes(markerKey(prefix, index + 1))
  ).every(Boolean);
  if (!total || !complete) {
    console.log(`main's ${sha} has no complete baselines yet.`);
    await output("found=false");
    return;
  }
  await mkdir(DIR, { recursive: true });
  const screenshots = keys.filter((key) => !key.startsWith(`${prefix}shards/`));
  await Promise.all(
    screenshots.map(async (key) =>
      writeFile(join(DIR, basename(key)), new Uint8Array(await bucket.file(key).arrayBuffer()))
    )
  );
  console.log(`Downloaded main's ${sha} ${screenshots.length} baseline screenshots.`);
  await output("found=true");
};

// Each shard uploads the ones its tests wrote, then its marker; together,
// every @ui moment.
const upload = async (sha, shard) => {
  const bucket = reportBucket();
  const prefix = commitPrefix(sha);
  const files = await filesIn(DIR).catch(() => []);
  await Promise.all(files.map((file) => bucket.write(`${prefix}${basename(file)}`, bunFile(file))));
  await bucket.write(markerKey(prefix, shard), String(files.length));
  console.log(`Uploaded ${files.length} baseline screenshots of ${sha}.`);
};

const commands = { download, upload };
const command = commands[process.argv[2]];
if (!command) {
  console.error(
    "Usage: bun scripts/visual-baseline.js download {sha} {shards} | upload {sha} {shard}"
  );
  process.exit(1);
}
await command(...process.argv.slice(3));
