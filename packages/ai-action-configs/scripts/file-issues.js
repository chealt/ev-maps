// Files an AI action's findings as issues of this repository (#427): an
// issue per finding no issue has the title of, with the LABELS (comma
// separated; created if missing) and the PRIORITY issue field. Prints what it
// filed, for the job's summary.
//
//   LABELS=security PRIORITY=High \
//     bun scripts/file-issues.js findings.json
//
// gh does the GitHub calls, with GH_TOKEN, in the repository it's run in.

import { readFile } from "node:fs/promises";
import { findingsErrors, issueBodyOf, newFindings } from "../src/issues.js";

const gh = (...args) => {
  const { exitCode, stdout, stderr } = Bun.spawnSync(["gh", ...args]);
  if (exitCode !== 0) {
    throw new Error(`gh ${args[0]} ${args[1] ?? ""} failed: ${stderr.toString().trim()}`);
  }
  return stdout.toString().trim();
};

// Issue fields are in preview: GraphQL has them behind this header.
const graphql = (query, variables = {}) =>
  JSON.parse(
    gh(
      "api",
      "graphql",
      "-H",
      "GraphQL-Features: issue_fields",
      "-f",
      `query=${query}`,
      ...Object.entries(variables).flatMap(([name, value]) => ["-F", `${name}=${value}`])
    )
  ).data;

// The Priority field's ID and its option's, from the organization's fields.
const priorityOf = (owner, name) => {
  const fields =
    graphql(
      `
        query ($owner: String!) {
          organization(login: $owner) {
            issueFields(first: 50) {
              nodes {
                ... on IssueFieldSingleSelect {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      `,
      { owner }
    ).organization?.issueFields?.nodes ?? [];
  const field = fields.find((node) => node.name === "Priority");
  const option = field?.options.find((candidate) => candidate.name === name);
  if (!option) {
    throw new Error(`The organization has no Priority field with a "${name}" option`);
  }
  return { fieldId: field.id, optionId: option.id };
};

const [file] = process.argv.slice(2);
const labels = (process.env.LABELS ?? "").split(",").filter(Boolean);
const priority = process.env.PRIORITY;

const text = await readFile(file, "utf8").catch(() => null);
if (text === null) {
  console.error(`pi wrote no findings (${file} is missing)`);
  process.exit(1);
}
const findings = JSON.parse(text);
const errors = findingsErrors(findings);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const titles = JSON.parse(
  gh("issue", "list", "--state", "all", "--limit", "5000", "--json", "title")
).map(({ title }) => title);
const toFile = newFindings(findings, titles);
if (!toFile.length) {
  console.log(`No new findings (${findings.length} found, all filed already).`);
  process.exit(0);
}

const existingLabels = new Set(
  JSON.parse(gh("label", "list", "--limit", "500", "--json", "name")).map(({ name }) => name)
);
for (const label of labels.filter((name) => !existingLabels.has(name))) {
  gh("label", "create", label);
}
const repository = JSON.parse(gh("repo", "view", "--json", "owner"));
const field = priority ? priorityOf(repository.owner.login, priority) : null;

console.log(`Filed ${toFile.length} of ${findings.length} findings:\n`);
for (const finding of toFile) {
  const url = gh(
    "issue",
    "create",
    "--title",
    finding.title,
    "--body",
    issueBodyOf(finding),
    ...labels.flatMap((label) => ["--label", label])
  );
  if (field) {
    const { id } = JSON.parse(gh("issue", "view", url, "--json", "id"));
    graphql(
      `
        mutation ($issueId: ID!, $fieldId: ID!, $optionId: ID!) {
          setIssueFieldValue(
            input: {
              issueId: $issueId
              issueFields: [{ fieldId: $fieldId, singleSelectOptionId: $optionId }]
            }
          ) {
            clientMutationId
          }
        }
      `,
      { issueId: id, ...field }
    );
  }
  console.log(`- ${url} ${finding.title}`);
}
