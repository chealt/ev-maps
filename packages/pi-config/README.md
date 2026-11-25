# pi config

The [pi](https://pi.dev) coding agent's setup for working on EV Maps, as a
pi package. The repository's `.pi/settings.json` loads it, so pi picks it up
in this project once you trust it (pi asks on the first start here).

## Extensions

- **model-fallback** (`extensions/model-fallback`): a virtual model,
  `fallback/auto`, the project's default. It sends each request to the first
  model of the chain in `model-fallback.json` and moves down the chain when
  one hits a rate or usage limit, retrying a limited model after its
  cooldown. When every model is limited, it says so and stops. `/fallback`
  shows the chain and cooldowns, `/fallback reset` clears them.

The chain is the repository's, all through [Radius](https://radius.earendil.com)
(Opus 5.5, then GPT 6.2 Sol, then GLM-5.3, then Mistral Large 4, then
Gemini 3.8 Flash): one gateway credential, no per-provider limits. Radius
must be authenticated (`/login radius`, stored in `~/.pi/agent/auth.json`);
the chain falls through Radius' routing for each model.
`~/.pi/agent/model-fallback.json` overrides it field by field on your
machine, e.g. to swap one link's provider. Credentials stay in
`~/.pi/agent/auth.json`, never here.

If you had the extension installed personally (`~/.pi/agent/extensions/`),
remove that copy: both would register `fallback/auto`.
