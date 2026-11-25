// One test per screenshot of the pull request's @ui tests
// (visual-compare/actual/), compared with main's of the same name
// (visual-compare/baseline/). A screenshot main doesn't have is new: a
// change to review too.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const ACTUAL_DIR = new URL("../../visual-compare/actual/", import.meta.url).pathname;
const files = (await readdir(ACTUAL_DIR)).filter((file) => file.endsWith(".png")).sort();

for (const file of files) {
  test(file, async () => {
    expect(await readFile(join(ACTUAL_DIR, file))).toMatchSnapshot(file);
  });
}
