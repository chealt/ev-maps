# EV Maps

A vanilla JavaScript + Web Components application for displaying EV charging stations on a map.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) (required)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Linting**: [oxlint](https://github.com/oxc-project/oxlint)
- **Formatting**: [oxfmt](https://github.com/oxc-project/oxfmt)
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com/)
- **Language**: JavaScript (ES Modules)
- **Styling**: Vanilla CSS
- **Components**: Native Web Components

## Project Structure

```
ev-maps/
├── packages/
│   ├── config/            # Shared configs
│   │   ├── oxlint.json    # Linting config
│   │   └── oxfmt.json     # Formatting config
│   └── app/              # Main application (@ev-maps/app)
│       ├── src/           # Source files
│       │   ├── components/ # Web Components
│       │   ├── styles.css # Global styles
│       │   └── main.js    # Entry point
│       ├── public/        # Static assets
│       ├── index.html     # HTML entry
│       ├── vite.config.js # Vite config
│       └── wrangler.toml  # Cloudflare config
├── .github/
│   └── workflows/
│       └── ci.yml         # GitHub Actions
├── package.json           # Root workspace
└── README.md
```

## Getting Started

### Prerequisites

1. Install [Bun](https://bun.sh/):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Clone the repository:
   ```bash
   git clone git@github.com:chealt/ev-maps.git
   cd ev-maps
   ```

### Install Dependencies

```bash
bun install
```

### Development

```bash
bun run dev
```

This starts the Vite development server at `http://localhost:3000`.

### Build

```bash
bun run build
```

### Lint

```bash
bun run lint
```

### Format

```bash
bun run format
```

## Deployment

### Cloudflare Pages

1. Connect your GitHub repository to Cloudflare Pages.
2. Use the following build settings:
   - Build command: `bun run build`
   - Build output directory: `apps/ev-maps/dist`

### Manual Deployment

```bash
cd packages/app
bun run build
# Upload the dist/ folder to your hosting provider
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |
| `bun run lint` | Run linter |
| `bun run format` | Format code |
| `bun run format:check` | Check formatting |

## Architecture

- **Web Components**: Native custom elements for reusable UI components.
- **Vanilla JS**: No frameworks, just modern JavaScript (ES2024).
- **CSS**: Vanilla CSS with modern features (CSS Grid, Flexbox, etc.).
- **Cloudflare**: Optimized for deployment on Cloudflare's edge network.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Run `bun run lint` and `bun run format`.
5. Commit your changes.
6. Push to your fork.
7. Open a pull request.

## License

MIT
