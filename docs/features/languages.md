# Languages

## Languages

English, Polish and Hungarian, each built as its own static
pages (`/en/`, `/pl/`, `/hu/`); see
[Languages](../DEVELOPMENT_GUIDELINES.md#languages). Google Maps loads in the
page's language, and the account menu links to the page in the other
languages.

## Language and country

The Worker redirects `/` to
`/{language}/{country}/`: the language picked in the account menu (the
`ev-maps-language` cookie), else the first language in the browser's
`Accept-Language` that has pages, else English; and the country of the
visitor's IP address (Cloudflare's `request.cf.country`). Without a page for
that country it redirects to `/{language}/`. It only picks the URL; every
page is served as a static file.
