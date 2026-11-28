// Fixes an AI action's findings, a pull request each (#450): for every
// finding no open pull request fixes already (src/fixes.js), at most LIMIT,
// it runs pi on a fresh branch from the base, ai/{NAME}/{id}, and when pi
// changed something, commits, pushes and opens the pull request with the
// LABELS (comma separated; created if missing). Prints what it did, for the
// job's summary.
//
//   NAME=security-audit PREFIX=Security LIMIT=3 LABELS=security \
//     PROVIDER=radius MODEL=claude-opus-5-5 FOOTER="Made by …" \
//     bun scripts/fix-findings.js findings.json
//
// gh and git do the GitHub calls, with GH_TOKEN and the checkout's
// credentials, in the repository it's run in.

import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  branchOf,
  findingsToFix,
  fixFindingsErrors,
  fixPromptOf,
  pullRequestBodyOf,
  titleOf,
} from "../src/fixes.js";

const run = (command, ...args) => {
  const { exitCode, stdout, stderr } = Bun.spawnSync([command, ...args], {
    stderr: "pipe",
  });
  if (exitCode !== 0) {
    throw new Error(`${command} ${args[0]} failed: ${stderr.toString().trim()}`);
  }
  return stdout.toString().trim();
};
const gh = (...args) => run("gh", ...args);
const git = (...args) => run("git", ...args);

const [file] = process.argv.slice(2);
const { NAME: name, PREFIX: prefix = "AI", PROVIDER: provider, MODEL: model } = process.env;
const limit = Number(process.env.LIMIT) || 3;
const labels = (process.env.LABELS ?? "").split(",").filter(Boolean);
const footer = process.env.FOOTER;

const text = await readFile(file, "utf8").catch(() => null);
if (text === null) {
  console.error(`pi wrote no findings (${file} is missing)`);
  process.exit(1);
}
const findings = JSON.parse(text);
const errors = fixFindingsErrors(findings);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const open = JSON.parse(
  gh("pr", "list", "--state", "open", "--limit", "1000", "--json", "headRefName,title")
);
const toFix = findingsToFix(findings, open, { name, prefix, limit });
console.log(
  `${findings.length} findings; fixing ${toFix.length} (the rest have an open pull request, or are over the limit of ${limit}).\n`
);
if (!toFix.length) {
  process.exit(0);
}

const existingLabels = new Set(
  JSON.parse(gh("label", "list", "--limit", "500", "--json", "name")).map(({ name }) => name)
);
for (const label of labels.filter((label) => !existingLabels.has(label))) {
  gh("label", "create", label);
}

const base = git("rev-parse", "--abbrev-ref", "HEAD");
let failed = 0;
for (const finding of toFix) {
  const branch = branchOf(name, finding);
  try {
    git("reset", "--hard");
    git("clean", "-fd");
    git("checkout", "-B", branch, `origin/${base}`);
    // pi's output streams to the log; its final message is the description.
    const pi = Bun.spawnSync(
      [
        "pi",
        "--print",
        "--no-session",
        "--no-approve",
        "--provider",
        provider,
        "--model",
        model,
        fixPromptOf(finding),
      ],
      { stderr: "inherit" }
    );
    if (pi.exitCode !== 0) {
      throw new Error(`pi failed (exit ${pi.exitCode})`);
    }
    if (!git("status", "--porcelain")) {
      console.log(`- ${finding.title}: pi changed nothing`);
      continue;
    }
    const title = titleOf(prefix, finding);
    git("add", "-A");
    git("commit", "-m", `fix: ${finding.title.trim()} (AI action)`);
    git("push", "--force", "origin", branch);
    const bodyFile = join(tmpdir(), `${finding.id}.md`);
    await writeFile(bodyFile, pullRequestBodyOf(finding, pi.stdout.toString(), footer));
    const url = gh(
      "pr",
      "create",
      "--base",
      base,
      "--head",
      branch,
      "--title",
      title,
      "--body-file",
      bodyFile,
      ...labels.flatMap((label) => ["--label", label])
    );
    console.log(`- ${url} ${title}`);
  } catch (error) {
    failed += 1;
    console.log(`- ${finding.title}: failed, ${error.message}`);
  }
}
git("checkout", "-f", base);
if (failed) {
  process.exit(1);
}
