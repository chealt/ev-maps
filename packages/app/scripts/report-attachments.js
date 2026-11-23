// Shared by the reports CI builds from Playwright's JSON summary
// (scripts/a11y-report.js, scripts/performance-report.js).

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]
  );

// [{ title, file, value }] for every test result with a JSON attachment of
// that name (e.g. "axe", "web-vitals"; packages/e2e/src/test.js).
const attachmentsNamed = (results, name) => {
  const found = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        for (const result of test.results) {
          const attachment = result.attachments?.find((item) => item.name === name);
          if (attachment?.body) {
            found.push({
              title: [...titles, spec.title].join(" › "),
              file: spec.file,
              value: JSON.parse(Buffer.from(attachment.body, "base64").toString("utf8")),
            });
          }
        }
      }
    }
    for (const child of suite.suites ?? []) {
      walk(child, suite.title && !suite.title.endsWith(".js") ? [...titles, suite.title] : titles);
    }
  };
  for (const suite of results.suites ?? []) {
    walk(suite, []);
  }
  return found;
};

export { attachmentsNamed, escapeHtml };
