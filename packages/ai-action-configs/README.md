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
  "model": "claude-opus-5-5",
  "provider": "anthropic"
}
```

- `cron`: `hourly`, `daily` (06:xx UTC), `weekly` (Mondays 06:xx UTC), or a
  five-field cron expression. Named schedules get a minute of their own, so
  the configs don't all start at once.
- `provider` and `model`: as pi names them (`pi --list-models`). The
  provider's API key comes from the repository secret pi reads, e.g.
  `ANTHROPIC_API_KEY` (`src/workflows.js` lists them).
- The file name is the config's name: lowercase letters, digits and dashes.

## The pull request's description

Every prompt gets one more instruction: pi's final message becomes the
description of its pull request, so it reports what it changed and why (for
an upgrade, each package with the version it went from and to) and what it
left alone. The description is that report, under a header naming the model
and the config, with the prompt quoted.

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
