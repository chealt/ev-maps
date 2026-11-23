// Writes a workflow per AI action config (configs/*.json) into
// .github/workflows/ai-{name}.yml, and deletes the generated ones whose
// config is gone. Prints what changed; exits non-zero on an invalid config.
//
//   bun scripts/generate-workflows.js

import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { GENERATED_MARKER, configErrors, workflowOf } from "../src/workflows.js";

const CONFIGS = new URL("../configs/", import.meta.url);
const WORKFLOWS = new URL("../../../.github/workflows/", import.meta.url);
const PREFIX = "ai-";

const configs = [];
const errors = [];
for (const file of (await readdir(CONFIGS)).filter((name) => name.endsWith(".json")).sort()) {
  const name = file.slice(0, -".json".length);
  let config;
  try {
    config = JSON.parse(await readFile(new URL(file, CONFIGS), "utf8"));
  } catch (error) {
    errors.push(`${name}: not valid JSON (${error.message})`);
    continue;
  }
  errors.push(...configErrors(name, config));
  configs.push({ name, config });
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const changes = [];
const wanted = new Set();
for (const { name, config } of configs) {
  const file = `${PREFIX}${name}.yml`;
  wanted.add(file);
  const content = workflowOf(name, config);
  const current = await readFile(new URL(file, WORKFLOWS), "utf8").catch(() => null);
  if (current !== content) {
    await writeFile(new URL(file, WORKFLOWS), content);
    changes.push(`${current === null ? "added" : "updated"} ${file}`);
  }
}
// Only workflows this script generated: others may start with "ai-" too.
for (const file of await readdir(WORKFLOWS)) {
  if (!file.startsWith(PREFIX) || wanted.has(file)) {
    continue;
  }
  const content = await readFile(new URL(file, WORKFLOWS), "utf8");
  if (content.startsWith(GENERATED_MARKER)) {
    await rm(new URL(file, WORKFLOWS));
    changes.push(`removed ${file}`);
  }
}
console.log(changes.length ? changes.join("\n") : "The AI action workflows are up to date.");
