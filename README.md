# EV Maps

Find electric vehicle charging stations on a map.

**Live:** <https://ev.chealt.com>

## Features

- Full-screen map of EV chargers in the visible area, with nearby chargers
  grouped into clusters when zoomed out
- Charger details: address, connectors and power, operator, access, cost and
  status; signed in, how many points are free right now, and red pins where
  none is (Poland and France)
- Filter chargers by connector type, charging power and operator; signed
  in, the filters are saved to your account too, so you have them on every
  device
- Favorites: signed in, save chargers with the heart, list them nearest to
  the map's center first from the account menu, or show only them on the map
- Signed in, find chargers with a café, toilets, a restaurant or a playground
  within 150 m (from OpenStreetMap), on the map or along a route
- Locate me, and the map remembers where you were last time
- Plan a route between two places and see the chargers along it, with the
  same power filters
- Sign in with Google, GitHub, Microsoft or Apple, and stay signed in; the
  account menu has the light, dark or system theme and the language, signed
  in or not
- In English, Polish and Hungarian, with a static page for every country

Charging data comes from [Open Charge Map](https://openchargemap.org),
[OpenStreetMap](https://www.openstreetmap.org) (© OpenStreetMap contributors,
ODbL) and the national registers of Poland
([EIPA](https://eipa.udt.gov.pl)) and France
([IRVE](https://transport.data.gouv.fr), Licence Ouverte), with live
availability; the map is [Google Maps](https://developers.google.com/maps).

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
