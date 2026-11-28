// What scripts/file-issues.js files: the findings an AI action wrote, minus
// the ones an issue was filed for already (#427).
//
// A finding: { "title": "…", "body": "…" }. A finding is filed already when
// an issue, open or closed, has its title: the prompt asks for the same title
// each time a problem is found, so a daily run doesn't file it again, and a
// problem closed as not one stays closed.

const normalise = (title) => title.trim().replace(/\s+/g, " ").toLowerCase();

// The findings' problems, as messages; none if they're valid.
const findingsErrors = (findings) => {
  if (!Array.isArray(findings)) {
    return ["The findings must be an array"];
  }
  return findings.flatMap((finding, index) =>
    ["title", "body"]
      .filter((field) => typeof finding?.[field] !== "string" || !finding[field].trim())
      .map((field) => `Finding ${index + 1}: ${field} is required`)
  );
};

// The findings to file: no title an issue has, and each title once.
const newFindings = (findings, issueTitles) => {
  const seen = new Set(issueTitles.map(normalise));
  return findings.filter(({ title }) => {
    const key = normalise(title);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

// The issue's body: the finding's, then who found it.
const issueBodyOf = (finding, footer) =>
  footer ? `${finding.body.trim()}\n\n---\n\n<sub>${footer}</sub>\n` : `${finding.body.trim()}\n`;

export { findingsErrors, issueBodyOf, newFindings };
