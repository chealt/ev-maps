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

## Search engines

`/sitemap.xml` (`src/pages/sitemap.xml.js`, `src/lib/sitemap.js`) lists
every page search engines may index in every language: the map, each
country page and the legal pages, each with its other languages as
`hreflang` alternates. `public/robots.txt` points to it. Every indexable
page has a canonical link to its own address without query strings, and its
`x-default` alternate is the English page (`/` for the home page, which the
Worker sends to the visitor's language and country). Pages with `noindex`
(admin, saved places, suggestions) are left out of both.

Country pages describe themselves for search results with the country and
the number of chargers (`countryDescription` in each language's
`common.js`); the other pages use the site's description. Every page has
Open Graph tags (title, description, address, language and
`public/og-image.png`, 1200×630, which `bun run icons` renders from the
logo) and a large-image card for X, so a shared link shows a preview.
