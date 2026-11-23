// Which end-to-end tests a pull request runs (scripts/select-e2e.js runs it
// in CI), from the files it changed and e2e-domains.json: the specs of every domain whose paths it touched, plus
// the tests tagged @regression, which always run. A change to `everything`,
// or to a file under packages/app that no domain lists, runs them all; other
// files (e.g. the Worker's, which the end-to-end tests fake) run only the
// regression tests.
//
// grepOf gives a pattern for `playwright test --grep` (empty to run them
// all); Playwright matches it against each test's file and title, so specs
// and tags combine in one run, shards and all.

import { Glob } from "bun";

const REGRESSION_TAG = "@regression";
const APP_DIR = "packages/app/";
const SPEC_FILE = /^packages\/(?:app\/src|admin\/components)\/(?:[\w-]+\/)*([\w-]+)\.spec\.js$/;

const matches = (patterns, file) => patterns.some((pattern) => new Glob(pattern).match(file));

// { all: true } or { tests: [spec names], domains: [names] }.
const selectE2e = (changedFiles, { everything, domains }) => {
  const tests = new Set();
  const hitDomains = new Set();
  for (const file of changedFiles) {
    if (matches(everything, file)) {
      return { all: true, reason: file };
    }
    // A changed spec runs itself, also a new one no domain lists yet.
    const spec = file.match(SPEC_FILE)?.[1];
    if (spec) {
      tests.add(spec);
      continue;
    }
    const hits = Object.entries(domains).filter(([, { paths }]) => matches(paths, file));
    if (!hits.length && file.startsWith(APP_DIR)) {
      return { all: true, reason: file };
    }
    for (const [name, domain] of hits) {
      hitDomains.add(name);
      for (const test of domain.tests) {
        tests.add(test);
      }
    }
  }
  return { all: false, tests: [...tests].sort(), domains: [...hitDomains].sort() };
};

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The pattern for `playwright test --grep`: the selected specs' files or the
// regression tag; "" runs everything.
const grepOf = (selection) =>
  selection.all
    ? ""
    : [...selection.tests.map((test) => `${escape(test)}\\.spec\\.js`), REGRESSION_TAG].join("|");

export { REGRESSION_TAG, grepOf, selectE2e };
