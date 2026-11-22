// Release notes for the commits since the last release, grouped by kind.
// main gets squash-merged pull requests with Conventional Commit titles, e.g.
// "feat: save chargers as favorites (#67)", so each commit is one change.
//
// Usage: bun scripts/release-notes.js [previous tag]
// Without a previous tag (the first release), every commit is included.
// Prints Markdown to stdout.
import { execFileSync } from "node:child_process";

const GROUPS = [
  ["feat", "New features"],
  ["fix", "Bug fixes"],
  ["perf", "Performance"],
  ["refactor", "Refactoring"],
  ["test", "Tests"],
  ["ci", "CI and deployment"],
  ["docs", "Documentation"],
  ["chore", "Other changes"],
];

// "type(scope)!: description" -> { type, scope, description }
const COMMIT = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?!?: (?<description>.+)$/;

const parse = (subject) => {
  const match = COMMIT.exec(subject);
  if (!match) {
    return { type: "chore", scope: undefined, description: subject };
  }
  const { type, scope, description } = match.groups;
  const known = GROUPS.some(([name]) => name === type);
  return { type: known ? type : "chore", scope, description };
};

const line = ({ scope, description }) => {
  const text = description.charAt(0).toUpperCase() + description.slice(1);
  return scope ? `- **${scope}:** ${text}` : `- ${text}`;
};

const notes = (subjects) => {
  const commits = subjects.map(parse);
  const sections = GROUPS.map(([type, title]) => {
    const lines = commits.filter((commit) => commit.type === type).map(line);
    return lines.length ? `## ${title}\n\n${lines.join("\n")}\n` : "";
  }).filter(Boolean);
  return sections.length ? sections.join("\n") : "No changes since the last release.\n";
};

const subjectsSince = (previous) =>
  execFileSync("git", ["log", "--format=%s", previous ? `${previous}..HEAD` : "HEAD"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);

if (import.meta.main) {
  process.stdout.write(notes(subjectsSince(process.argv[2])));
}

export { notes, parse };
