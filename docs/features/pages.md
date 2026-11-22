# Pages

## Rendering

Astro renders all HTML and CSS at build time. Web Components
only add behavior to that markup; see the
[Development Guidelines](../DEVELOPMENT_GUIDELINES.md).

## Country pages

Every page is under its language: `/en/` is the map
without data, and `/en/hu/`, `/en/pl/`, … are static pages, one per
country with chargers. Each contains the country's chargers, built from an
export of D1 (`packages/worker/scripts/export-chargers.js`); a country with
more than 4,000 gets an even spread of them (the fastest in each area), as
Cloudflare serves files up to 25 MiB. The map starts on the country and
shows them right away, also when zoomed out too far to load tiles; zoomed
in, it loads the area's tiles as usual. The country pages are rebuilt every
week (`refresh.yml`) and on every deploy.

## Installable app

Each language has a web app manifest
(`/{lang}/manifest.webmanifest`) whose start URL is `/`, so the installed
app opens in the user's language and country. Its PNG icons are generated
from `public/favicon.svg` with `bun run icons` in `packages/app`.

## Themes

Every color token is defined once with `light-dark()`;
`<ev-theme-picker>` sets `data-theme` on `<html>` and the map follows with
Google Maps' color scheme.
