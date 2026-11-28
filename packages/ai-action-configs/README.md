# AI action configs

Prompts the [pi](https://pi.dev) coding agent runs on a schedule in GitHub
Actions. Each config in `configs/` becomes a workflow of its own,
`.github/workflows/ai-{name}.yml`, which runs pi with its prompt and model
on its schedule and opens a pull request with whatever it changed (branch
`ai/{name}`).

```json
{
  "cron": "daily",
  "prompt": "Upgrade the packages released over a week ago",
  "model": "claude-opus-5-5"
}
```

- `cron`: `hourly`, `daily` (06:xx UTC), `weekly` (Mondays 06:xx UTC), or a
  five-field cron expression. Named schedules get a minute of their own, so
  the configs don't all start at once.
- `model`: a model ID of [Radius](https://radius.earendil.com), the
  organization's AI gateway (its catalog: `radius.pi.dev/v1/config`, or
  `pi --list-models radius`). Every action uses its model through Radius,
  with the `RADIUS_API_KEY` repository secret, so the organization's budgets,
  policies and analytics apply; a config naming another `provider` is
  rejected.
- The file name is the config's name: lowercase letters, digits and dashes.

## Findings as issues

A config with `issues` files what pi finds as issues instead of opening a
pull request, e.g. `configs/testing-audit.json`:

```json
"issues": { "labels": ["security"], "priority": "High" }
```

pi is told not to change the files and to write its findings to a JSON
file, `[{ "title": "…", "body": "…" }]`. `scripts/file-issues.js` then
opens an issue for each new one, with the labels (created if missing) and
the Priority issue field. A finding is new if no issue, open or closed,
has its title, so a daily run doesn't file the same problem again, and one
closed as not a problem stays closed. Its workflow can read the contents
and write issues, nothing else; pi's final message goes to the job's
summary.

## Findings fixed in pull requests

A config with `fixes` has pi fix what it finds, a pull request per
finding, e.g. `configs/security-audit.json`, the daily security audit:

```json
"fixes": { "labels": ["security"], "prefix": "Security", "limit": 3 }
```

pi first audits without changing the files and writes its findings to a
JSON file, `[{ "id": "…", "title": "…", "body": "…" }]`, the id a slug it
keeps the same each time it finds the problem. `scripts/fix-findings.js`
then skips every finding an open pull request fixes already: one on its
branch, `ai/{config}/{id}`, or titled `{prefix}: {title}`, and then those
pi, given the rest and the open pull requests (title, branch and the start
of the description), says fix the same problem, so a finding worded
differently or fixed by hand isn't fixed twice (if pi fails, the name check
alone decides). A pull request
closed without merging doesn't count, so the next run tries again. For each
of the rest, at most `limit` a run (3 by default), it runs pi on a fresh
branch from main to fix that finding alone, and when pi changed something,
commits, pushes and opens the pull request with the labels, its
description pi's report and the finding. The branches are pushed with the
`AI_ACTIONS_TOKEN`, so their checks run.

## The pull request's description

Every prompt gets one more instruction: pi's final message becomes the
description of its pull request, so it reports what it changed and why (for
an upgrade, each package with the version it went from and to) and what it
left alone. The description is the prompt quoted, then that report; the
pull request's label marks it as an AI's, so nothing in it says so.

## How the workflows stay in sync

`.github/workflows/ai-actions.yml` runs hourly, when the configs change on
main, and by hand. It tests and runs `scripts/generate-workflows.js`, which
writes a workflow for each new or changed config and deletes the generated
ones whose config is gone (only files it generated, marked at their top),
then opens a pull request with the changes.

GitHub's own token can't change workflow files, so that pull request needs
the `AI_ACTIONS_TOKEN` secret: a fine-grained token with Contents, Pull
requests and Workflows write access to this repository. The generated
workflows use it too, falling back to GitHub's token.

Run it locally with `bun run generate`; `bun test` checks the generator.
