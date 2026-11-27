---
description: Resolve a pull request's merge conflicts and push
argument-hint: "<pr number>"
---

Resolve the merge conflicts of pull request #$1.

1. `git fetch`, check out its branch, and rebase it onto `origin/main`. If
   it was stacked on a branch that's merged since (squash merges), use
   `git rebase --onto origin/main <old base>`.
2. Keep both sides of lists both added to (translations, `serverPages`,
   fixture exports, tests, sections); where test hunks interleave, take
   `main`'s file and add the pull request's tests back.
3. Check `git diff origin/main --stat` has only the pull request's change,
   and no `*.orig` files.
4. Run lint, `format:check`, and the tests of the conflicted files only.
5. Force-push, and say when GitHub shows it mergeable.
