# Languages

## Languages and copy

English, Polish and Hungarian, each built as its own static
pages (`/en/`, `/pl/`, `/hu/`); see
[Languages](../DEVELOPMENT_GUIDELINES.md#languages). Google Maps loads in the
page's language, and the account menu links to the page in the other
languages.

All copy is in `packages/app/src/i18n`, by language and section of the
site, and used only at build time: the client loads no i18n. Astro
renders every page's text with it at build time, and bakes the templates the
page's scripts fill in with live numbers (e.g. "2 EV chargers found") into
the page's HTML: only this language's, and only the sections this kind of
page uses (map, legal or admin; legal pages need none). The Worker's sign-in
email has its own text, next to its code (`src/email.js`).

## Language and country

The Worker redirects `/` to
`/{language}/{country}/`: the language picked in the account menu (the
`ev-maps-language` cookie), else the first language in the browser's
`Accept-Language` that has pages, else English; and the country of the
visitor's IP address (Cloudflare's `request.cf.country`). Without a page for
that country it redirects to `/{language}/`. It only picks the URL; every
page is served as a static file.
