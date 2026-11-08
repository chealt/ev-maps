# EV Maps

A modern web application for displaying EV charging stations, built with **Astro** for templating and **Web Components** for interactivity.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) (required)
- **Framework**: [Astro v4](https://astro.build/) (templating)
- **Components**: Native Web Components (interactivity)
- **Styling**: Vanilla CSS
- **Linting**: [oxlint](https://github.com/oxc-project/oxlint)
- **Formatting**: [oxfmt](https://github.com/oxc-project/oxfmt)
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com/)
- **Language**: JavaScript (ES Modules)

## Project Structure

```
ev-maps/
├── packages/
│   ├── dev-config/           # Shared development configs
│   │   ├── oxlint.json        # Linting configuration
│   │   ├── oxfmt.json         # Formatting configuration
│   │   └── package.json
│   └── app/                   # Main application
│       ├── astro.config.mjs   # Astro configuration
│       ├── wrangler.toml      # Cloudflare configuration
│       ├── src/
│       │   ├── components/
│       │   │   ├── MapApp.js      # Web Component logic
│       │   │   ├── MapApp.html    # Web Component HTML template
│       │   │   └── MapApp.css     # Web Component styles
│       │   ├── layouts/
│       │   │   └── Layout.astro   # Base layout template
│       │   ├── pages/
│       │   │   ├── index.astro    # Main page
│       │   │   └── index.css      # Page-specific styles
│       │   └── styles/
│       │       └── global.css     # Global styles
│       └── package.json
├── .github/
│   └── workflows/
│       ├── dev-config.yml     # CI for dev-config package
│       ├── app.yml             # CI for app package
│       └── monorepo.yml        # Root-level CI
├── package.json               # Root workspace
└── README.md
```

## Important Development Guidelines

⚠️ **DO NOT** inline HTML or CSS in JavaScript files.

✅ **DO** this:

```javascript
// MapApp.js
import template from "./MapApp.html?raw";
import "./MapApp.css";

export class MapApp extends HTMLElement {
  render() {
    this.shadowRoot.innerHTML = template;
  }
}
```

❌ **DO NOT** do this:

```javascript
// BAD - Inline HTML and CSS
render() {
  this.shadowRoot.innerHTML = `
    <style>
      /* CSS here */
    </style>
    <div>...</div>
  `;
}
```

**Always keep:**

- HTML in `.html` files
- CSS in `.css` files
- JavaScript in `.js` files

## Getting Started

### Prerequisites

1. Install [Bun](https://bun.sh/):

   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Install [Node.js LTS](https://nodejs.org/) (v20+):

   ```bash
   # Using nvm
   nvm install 20
   nvm use 20
   ```

3. Clone the repository:
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

This starts the Astro development server at `http://localhost:4321/`.

### Build

```bash
bun run build
```

Builds the production-ready app in `packages/app/dist/`.

### Lint

```bash
bun run lint
```

### Format

```bash
bun run format
```

## Scripts

| Script                 | Description              |
| ---------------------- | ------------------------ |
| `bun run dev`          | Start development server |
| `bun run build`        | Build for production     |
| `bun run preview`      | Preview production build |
| `bun run lint`         | Run linter               |
| `bun run format`       | Format code              |
| `bun run format:check` | Check formatting         |

## Deployment

### Cloudflare Pages

1. Connect your GitHub repository to Cloudflare Pages
2. Use the following build settings:
   - Build command: `bun run build`
   - Build output directory: `packages/app/dist`

### Manual Deployment

```bash
cd packages/app
bun run build
# Upload the dist/ folder to your hosting provider
```

## Architecture

- **Astro**: Handles static page generation and templating
- **Web Components**: Provide client-side interactivity
- **CSS**: Vanilla CSS with modern features (CSS Grid, Flexbox, etc.)
- **Cloudflare**: Optimized for deployment on Cloudflare's edge network

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes (following the guidelines above)
4. Run `bun run lint` and `bun run format`
5. Commit your changes
6. Push to your fork
7. Open a pull request

## License

MIT
