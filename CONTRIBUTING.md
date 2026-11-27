# Contributing

**Always create a pull request with your changes.** Never commit or push
directly to `main`, even for small fixes or documentation updates, so every
change can be reviewed before it's merged.

1. Fork the repository, or create a branch if you have access
2. Set up the project with the [Getting Started](docs/GETTING_STARTED.md) guide
3. Make your changes, following the
   [Development Guidelines](docs/DEVELOPMENT_GUIDELINES.md) and
   [Testing Guidelines](docs/TESTING_GUIDELINES.md)
4. Run `bun run lint`, `bun run format` and the tests of what you changed
   (see [Running Tests](docs/TESTING_GUIDELINES.md#running-tests)); CI runs
   the rest
5. Commit your changes using
   [Conventional Commits](https://www.conventionalcommits.org/)
6. Open a pull request

Pull requests from this repository get a preview deployment; see
[Deployment](docs/DEPLOYMENT.md).

## Picking Up Issues

Pick up open issues in the order of their **Priority** field: Urgent, then
High, Medium and Low, and last the issues without one. Within a priority,
take the oldest issue first (the lowest number). Skip an issue that already
has an open pull request.

Priority is a GitHub issue field, not a label. The REST API returns it in
`issue_field_values`, so this lists the open issues with theirs:

```sh
gh api 'repos/chealt/ev-maps/issues?state=open&per_page=100' --jq '.[]
  | select(.pull_request | not)
  | "#\(.number) \([.issue_field_values[]?
      | select(.issue_field_name == "Priority")
      | .single_select_option.name] | first // "none") \(.title)"'
```

## Working with pi

The repository carries its [pi](https://pi.dev) setup: `.pi/settings.json`
loads `packages/pi-config`, whose extensions (e.g. the model fallback chain)
pi uses once you trust the project. See `packages/pi-config/README.md`.
