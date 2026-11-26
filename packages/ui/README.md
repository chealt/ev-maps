# @ev-maps/ui

EV Maps' generic UI components: Astro components that render the HTML, with
their CSS, and no copy of their own (the page passes its text in). They use
the app's design tokens (`packages/app/src/layouts/global.css`), so they look
right on any of its pages.

| Import                               | What                                                       |
| ------------------------------------ | ---------------------------------------------------------- |
| `@ev-maps/ui/Button.astro`           | A button: `variant`, `size`                                |
| `@ev-maps/ui/Icon.astro`             | A `lucide-static` icon: `size`, `filled`                   |
| `@ev-maps/ui/Badge.astro`            | A short label in a pill: `tone` (`Badge.css` for scripts)  |
| `@ev-maps/ui/Card.astro`             | A surface for one item: `as` (a button or link: clickable) |
| `@ev-maps/ui/EmptyState.astro`       | What a list shows when it has nothing: `icon`              |
| `@ev-maps/ui/SegmentedControl.astro` | One choice of a few: `legend`, `name`, `options`, `value`  |
| `@ev-maps/ui/Dialog.astro`           | A full-screen dialog: `title`, `closeLabel`; slots         |
| `@ev-maps/ui/Field.astro`            | A label, its control (`.field-control`) and a hint         |
| `@ev-maps/ui/Tooltip.astro`          | A hint on hover or focus: `text`, `placement`, `align`     |
| `@ev-maps/ui/Table.astro`            | A data table that scrolls sideways: `density`              |
| `@ev-maps/ui/Switch.astro`           | An on/off setting: its label the slot                      |
| `@ev-maps/ui/BarChart.astro`         | A bar per day; its `title` and `id`                        |
| `@ev-maps/ui/bar-chart.js`           | `renderBarChart`, `formatDay`: fill it in                  |

Treat them like a third-party library's components: generic, with no
domain or business logic. Components that know about chargers, the map or
the account stay in the app (`packages/app/src/components`) or the admin
area (`packages/admin/components`). A component moves here when it's
generic: no app state, no translations, no API calls; and when the app and
the admin area would otherwise each build their own (#307).
