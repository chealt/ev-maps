# @ev-maps/ui

EV Maps' generic UI components: Astro components that render the HTML, with
their CSS, and no copy of their own (the page passes its text in). They use
the app's design tokens (`packages/app/src/layouts/global.css`), so they look
right on any of its pages.

| Import                       | What                                      |
| ---------------------------- | ----------------------------------------- |
| `@ev-maps/ui/Button.astro`   | A button: `variant`, `size`               |
| `@ev-maps/ui/Icon.astro`     | A `lucide-static` icon: `size`, `filled`  |
| `@ev-maps/ui/BarChart.astro` | A bar per day; its `title` and `id`       |
| `@ev-maps/ui/bar-chart.js`   | `renderBarChart`, `formatDay`: fill it in |

Components that know about chargers, the map or the account stay in the app
(`packages/app/src/components`). A component moves here when it's generic:
no app state, no translations, no API calls.
