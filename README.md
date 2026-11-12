# EV Maps

Find electric vehicle charging stations on a map.

**Live:** <https://ev-maps.chealt.workers.dev>

## Features

- Full-screen map of EV chargers in the visible area, with nearby chargers
  grouped into clusters when zoomed out
- Charger details: address, connectors and power, operator, access, cost and
  status
- Locate me, and the map remembers where you were last time
- Sign in with Google; the account menu has sign-out and a light, dark or
  system theme

Charging data comes from [Open Charge Map](https://openchargemap.org); the map
is [Google Maps](https://developers.google.com/maps).

## Documentation

| Document                                                 | Contents                                               |
| -------------------------------------------------------- | ------------------------------------------------------ |
| [Getting Started](docs/GETTING_STARTED.md)               | Prerequisites, setup, environment variables, scripts   |
| [Architecture](docs/ARCHITECTURE.md)                     | Tech stack, project structure and how the parts fit    |
| [Deployment](docs/DEPLOYMENT.md)                         | Cloudflare Workers, GitHub secrets, Google Cloud setup |
| [CI](docs/CI.md)                                         | How the GitHub Actions workflow is organized           |
| [Development Guidelines](docs/DEVELOPMENT_GUIDELINES.md) | Components, CSS, code quality, commit messages         |
| [Testing Guidelines](docs/TESTING_GUIDELINES.md)         | How to write Playwright tests                          |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
