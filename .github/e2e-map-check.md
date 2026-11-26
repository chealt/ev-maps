# The E2E Map Check

You are checking one pull request of this repository: is
`packages/app/e2e-domains.json`, the map of which end-to-end specs a pull
request runs, still correct after it? Read
`docs/TESTING_GUIDELINES.md#which-tests-a-pull-request-runs` and
`packages/app/scripts/e2e-selection.js` first, for how the map is used.

Below are the pull request's changed files (`git diff --name-status`, so
`A` added, `M` modified, `D` deleted, `R` renamed), its diff (cut short
when it's long: then read the files themselves) and what
`scripts/select-e2e.js` selected for it. A unit test already checks that
every spec the map names exists and that every spec is in a domain: don't
repeat that. Check what it can't:

1. **Added or renamed files under `packages/app` or `packages/admin`:** is
   each one in the paths of the domain whose specs exercise it? A file no
   domain lists runs every test, which is slow but safe: flag it, with the
   domain it belongs to.
2. **Modified files:** read the diff, e.g. the imports it adds, and what
   imports the changed files (grep for the file's name). When code a
   domain lists is now used by the code of another domain, whose specs
   would catch a break in it, say that the other domain needs it too (or
   that it belongs in `everything`, if most domains use it).
3. **Added or moved specs:** is each in the domain of the code it tests,
   rather than the domain of the folder it happens to be in?
4. **Deleted or renamed files:** does a path in the map now match nothing?

Judge from the code, not the names: a spec exercises a file when the pages
it opens run that file. Don't flag something you're not sure of; say what
you'd check instead. Only the map is in question, not the code or the
tests' quality.

Write your report in Markdown for the pull request's author, short: for each
problem, the file, the domain it should be in (or the path to remove), and
why, in one or two sentences, with the exact change to
`packages/app/e2e-domains.json`. If the map is right, say so in a sentence.
Make the last line of your report exactly `VERDICT: OK` when the map is
right, or `VERDICT: UPDATE NEEDED` when it needs a change.
