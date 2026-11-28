import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A fake `gh` that answers both of the script's searches with the same
// issues, applying --jq like gh does.
const dir = mkdtempSync(join(tmpdir(), "pick-issue-"));
const issuesFile = join(dir, "issues.json");
writeFileSync(
  join(dir, "gh"),
  `#!/usr/bin/env bash
filter=""
while [ $# -gt 0 ]; do
  if [ "$1" = "--jq" ]; then filter="$2"; shift; fi
  shift
done
if [ -n "$filter" ]; then jq "$filter" "${issuesFile}"; else cat "${issuesFile}"; fi
`
);
chmodSync(join(dir, "gh"), 0o755);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const pick = (items) => {
  writeFileSync(issuesFile, JSON.stringify({ items }));
  const run = Bun.spawnSync(["bash", join(import.meta.dir, "pick-issue.sh"), "owner/repo"], {
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
  });
  expect(run.exitCode).toBe(0);
  return run.stdout.toString().trim();
};

const issue = (number, authorAssociation, priority) => ({
  number,
  author_association: authorAssociation,
  issue_field_values: priority
    ? [{ issue_field_name: "Priority", single_select_option: { name: priority } }]
    : [],
});

describe("pick-issue.sh", () => {
  test("picks by priority, then the oldest", () => {
    expect(pick([issue(3, "MEMBER", "High"), issue(1, "OWNER"), issue(2, "MEMBER", "High")])).toBe(
      "2"
    );
  });

  test("leaves out issues anyone outside the repository opened", () => {
    expect(
      pick([
        issue(1, "NONE", "Urgent"),
        issue(2, "CONTRIBUTOR", "Urgent"),
        issue(3, "FIRST_TIME_CONTRIBUTOR", "Urgent"),
        issue(4, "COLLABORATOR", "Low"),
      ])
    ).toBe("4");
    expect(pick([issue(1, "NONE", "Urgent")])).toBe("");
  });
});
