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

## One fix a run

A config with `fixes` has pi fix one problem a run, in a pull request of its
own, e.g. `configs/security-audit.json`, the daily security audit:

```json
"fixes": { "labels": ["security"], "prefix": "Security" }
```

pi runs once: it looks for the most serious problem the prompt asks about
that no open pull request fixes yet (it lists and reads them with `gh`),
fixes it, and runs the tests, the lint and the format check. Its final
message's first line becomes the pull request's title, after the prefix,
and the rest its description; the run opens it on its own branch,
`ai/{config}/{run id}`, with the labels and the `AI_ACTIONS_TOKEN`, so its
checks run. When pi changes nothing, no pull request is opened. The next
run takes the next problem.

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
