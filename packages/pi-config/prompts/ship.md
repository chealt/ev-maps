---
description: Check, commit, push and open a pull request for the current change
argument-hint: "[issue number]"
---

Ship the current change${1:+ for issue #$1}.

1. `bun run format`, then `bun run lint`, `bun run format:check`, and
   `bun run lint:css` in `packages/app` if CSS changed.
2. Run only the tests of what changed (AGENTS.md); check new E2E files are
   in `packages/app/e2e-domains.json` and new UI has a `@ui` capture.
3. Commit with a conventional commit message${1:+ ending in (#$1)}, push
   the branch, and open a pull request: what changed and why as bullets,
   what's tested, and anything the reviewer must check or decide.
4. Reply with the pull request's URL and anything left open, briefly.
