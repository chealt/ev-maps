# Development Guidelines

This document outlines the coding standards and best practices for the EV Maps
project.

## Core Principles

### 🚨 CRITICAL RULES

**✅ DO use Web Components as behavior wrappers for Astro-rendered HTML.**

**✅ Astro renders HTML/CSS, Web Components add client-side behavior only.**

**❌ NEVER create HTML or CSS inside Web Component JavaScript files.**

**❌ NEVER inline HTML or CSS in JavaScript files.**

**❌ NEVER use shadow DOM in Web Components (unless explicitly approved).**

**✅ DO build every control from the design system: `@ev-maps/ui`
components, the design tokens, and the styles of the controls already
shipped (e.g. the place input's fields, the corridor's chips).**

**❌ NEVER ship raw, default-styled browser controls** (bare `<select>`,
`<input>` or `<button>` with only a border), and never leave controls in a
row misaligned: give them one height and align them at the bottom.

### Architecture Pattern

**Create Web Components ONLY for specific custom functionality,
not for generic abstractions.**

```text
Component Structure:
├── button/
│   ├── Button.astro      # Renders HTML + imports CSS (generic, reusable)
│   └── Button.css        # Styles only
└── map/
    ├── Map.astro         # Renders HTML + imports CSS
    ├── Map.css           # Styles only
    └── Map.js    # Web Component - specific functionality only
```

**How it works:**

1. Astro renders the HTML template with CSS
2. Web Component adds **specific** client-side functionality
3. Web Component does NOT create any HTML - it only adds behavior
4. **Do NOT create Web Components for generic elements like buttons** -
   only for components with specific functionality

### Web Component Best Practices

1. **Omit unnecessary constructor**: If your constructor only calls `super()`,
   remove it entirely.

2. **Naming convention**: Use simple, descriptive names for Web Component files.
   Do NOT use `.element.js` suffix - it's redundant. Use `ComponentName.js`
   directly.

3. **Self-contained components**: Each Web Component should be wrapped in an
   Astro component that includes its script via `<script src="...">`. This
   makes components composable and ensures scripts are only loaded when the
   component is used.

   ```astro
   <!-- LocateButton.astro -->
   <ev-locate-button>
     <Button variant="primary">Locate Me</Button>
     <script src="./LocateButton.js"></script>
   </ev-locate-button>
   ```

4. **Use `<script src="...">` not module imports**: For Web Component scripts,
   use regular script tags with src attributes. Astro will handle them as
   modules automatically. This is simpler and more reliable than using
   `import` statements in script tags.

   ```astro
   <!-- ✅ Good -->
   <script src="./Map.js"></script>

   <!-- ❌ Bad -->
   <script type="module">
     import "../components/map/Map.js";
   </script>
   ```

5. **No global script loading**: Do NOT load Web Component scripts in
   Layout.astro or other global files. Load them in the Astro component that
   uses them, so they're only loaded when needed.

6. **No global CSS imports**: Do NOT import CSS files in Layout.astro or other
   global files. Each component should import its own CSS in its Astro file.
   This ensures CSS is only loaded when the component is used.

   ```astro
   <!-- Button.astro -->
   ---
   import './Button.css';
   ---

   <button class="button">...</button>
   ```

7. **CSS co-located with components**: Place CSS files in the same directory
   as the component that uses them. Global CSS should be in the layouts
   directory and imported in Layout.astro. All CSS files should be in the
   src directory and imported where needed.

8. **Global CSS only for truly global styles**: The global.css file should
   only contain CSS variables, base element styles, and utility classes.
   Component-specific styles should be in the component's CSS file,
   not in global.css.

9. **Use CSS variables for all values**: All colors, fonts, font sizes,
   widths, heights, gaps, borders, z-indexes, opacity, transitions, and other
   style values should be defined as CSS variables and used throughout the
   application. This ensures consistency and makes theming easier.
   **No hex colors or px values in component CSS files**, except where a
   custom property is defined (colors always belong in `global.css`).
   rem values are allowed, but prefer a shared token when one fits.

   - **Shared tokens** (colors, typography, spacing, radii, shadows,
     z-indexes, ...) live in `global.css`.
   - **Component-specific variables** (e.g. a marker size or panel width) live
     at the top of the component's CSS file, on the component's root selector.
     Move a variable to `global.css` once a second component needs it.

   ```css
   /* global.css */
   :root {
     --color-primary: #2563eb;
     --font-size-base: 1rem;
     --spacing-md: 1rem;
     --border-radius-sm: 4px;
     --z-dropdown: 100;
     --opacity-disabled: 0.6;
     --transition-fast: 0.2s ease;
   }

   /* Component CSS */
   .button {
     background-color: var(--color-primary);
     padding: var(--spacing-sm) var(--spacing-md);
     border-radius: var(--border-radius-sm);
     opacity: var(--opacity-disabled);
     transition: all var(--transition-fast);
   }
   ```

   **Categories of variables:**

   - Colors: `--color-primary`, `--color-text`, `--color-background`, etc.
   - Typography: `--font-family`, `--font-size-*`, `--font-weight-*`,
     `--line-height-*`
   - Spacing: `--spacing-xs`, `--spacing-sm`, `--spacing-md`, etc.
   - Borders: `--border-radius-*`, `--border-width`
   - Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`
   - Z-indexes: `--z-dropdown`, `--z-sticky`, `--z-fixed`, `--z-modal`
   - Opacity: `--opacity-disabled`, `--opacity-background`, etc.
   - Transitions: `--transition-fast`, etc.
   - Layout: `--container-max-width`, `--container-padding`, etc.

10. **Use CSS nesting**: Use CSS nesting (native browser feature) to organize
    related styles and reduce repetition. This makes CSS more maintainable
    and easier to read.

    ```css
    /* ✅ Good - nested selectors */
    .button {
      background: var(--color-primary);

      &:hover {
        background: var(--color-primary-dark);
      }

      &.secondary {
        background: var(--color-surface);
      }
    }

    /* ❌ Bad - flat selectors */
    .button {
      background: var(--color-primary);
    }
    .button:hover {
      background: var(--color-primary-dark);
    }
    .button.secondary {
      background: var(--color-surface);
    }
    ```

11. **Minimal comments**: Write self-documenting code. Avoid comments that
    just repeat what the code does. Use descriptive names for functions,
    variables, and classes instead of adding comments.

    ```astro
    <!-- ✅ Good - Astro's class:list -->
    <button class:list={["button", variant, size]}>
      <slot />
    </button>

    <!-- ❌ Bad - manual array join -->
    <button
      class={["button", variant, size]
        .filter(Boolean)
        .join(" ")}
    >
      <slot />
    </button>
    ```

    ```javascript
    // ✅ Good - self-documenting
    handleLocationFound(statusEl, event) {
      if (statusEl && event.detail) {
        statusEl.textContent = `Location: ${event.detail.lat},
          ${event.detail.lng}`;
      }
    }

    // ❌ Bad - redundant comment
    /**
     * Handles location found event
     * Updates status element with location
     */
    handleLocationFound(statusEl, event) {
      if (statusEl && event.detail) {
        statusEl.textContent = `Location: ${event.detail.lat},
          ${event.detail.lng}`;
      }
    }
    ```

    ```text
    ✅ Good:
    components/
    └── locate-button/
        └── LocateButton.js

    ❌ Bad:
    components/
    └── locate-button/
        └── LocateButton.element.js  # Redundant suffix
    ```

    The default constructor from `HTMLElement` is sufficient.

12. **Use `connectedCallback()` for initialization**: This is where you should
    set up event listeners and DOM references.

### ✅ Example: Map Component with Geolocation

**Button.astro** (Generic reusable button - NO Web Component):

```astro
---
interface Props {
  variant?: "primary" | "secondary";
  dataAction?: string; // For event delegation
}
const { variant = "primary", dataAction } = Astro.props;
---

<button class:list={["button", variant]} data-action={dataAction}>
  <slot />
</button>
```

**Map.astro** (Renders HTML):

```astro
---
import Button from "../button/Button.astro";
---

<ev-map>
  <div class="map-container">
    <div class="map-placeholder">
      <h2>EV Charging Stations</h2>
    </div>
    <div class="controls">
      <Button variant="primary" dataAction="locate">
        Locate Me
      </Button>
      <Button variant="secondary" dataAction="filters">
        Filters
      </Button>
    </div>
    <div class="status"></div>
  </div>
</ev-map>
```

**Map.js** (Specific functionality - geolocation):

```javascript
// Web Component with SPECIFIC functionality
class MapElement extends HTMLElement {
  connectedCallback() {
    const locateBtn = this.querySelector('[data-action="locate"]');
    const filterBtn = this.querySelector('[data-action="filters"]');
    const statusEl = this.querySelector(".status");

    // Specific: Handle geolocation
    locateBtn?.addEventListener("click", () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            statusEl.textContent = `Lat: ${position.coords.latitude}`;
          },
          (error) => {
            statusEl.textContent = `Error: ${error.message}`;
          }
        );
      }
    });

    // Specific: Handle filters
    filterBtn?.addEventListener("click", () => {
      statusEl.textContent = "Showing filters";
    });
  }
}
customElements.define("ev-map", MapElement);

export { MapElement };
```

**Result:**

- Astro renders all HTML and CSS
- `ev-map` Web Component adds **specific** geolocation functionality
- Buttons are just Astro components - no generic Web Component wrapper needed
- No HTML/CSS in JavaScript!

## Component Architecture

### ✅ Recommended Pattern

Every component is an Astro component. Add a Web Component only when the
component needs specific client-side behavior:

```text
components/
├── button/
│   ├── Button.astro      # HTML template + props (no JavaScript)
│   └── Button.css        # Styles only
└── locate-button/
    ├── LocateButton.astro  # Renders <ev-locate-button> + loads its script
    └── LocateButton.js     # Behavior only
```

**Button.astro:**

```astro
---
import type { HTMLAttributes } from "astro/types";
import "./Button.css";

interface Props extends HTMLAttributes<"button"> {
  variant?: "primary" | "secondary";
}

const {
  variant = "primary",
  type = "button",
  class: className,
  ...attrs
} = Astro.props;
---

<button
  type={type}
  class:list={["button", variant, className]}
  {...attrs}
>
  <slot />
</button>
```

**Button.css:**

```css
.button {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius-sm);
  cursor: pointer;

  &:disabled {
    opacity: var(--opacity-disabled);
    cursor: not-allowed;
  }
}
```

### Controls: Use the Design System

Every interactive control — button, input, select, chip — must look like the
rest of the app, on every page including the admin area:

- Use the `@ev-maps/ui` components (`Button`, `Icon`) where one fits; don't
  hand-roll a styled `<button>`.
- Style inputs and selects like the app's fields: soft muted background
  (`--color-surface-muted`), `--border-radius-md`, the primary focus ring,
  no hard borders. Replace the native select arrow with a Lucide chevron
  (`appearance: none` plus an absolutely positioned `Icon`), so it doesn't
  look like a 2005 form.
- Use the design tokens (`--color-*`, `--spacing-*`, `--font-size-*`,
  `--transition-fast`) — never raw colors, pixel font sizes or magic
  paddings.
- Controls side by side in a row share one height and align at the bottom
  (`align-items: flex-end`), buttons and links included.
- Verify visually before opening a pull request: screenshot the control in
  both themes (or look at the `@ui` evidence) and check alignment, spacing
  and hover/focus states.

### Icons

Use [Lucide](https://lucide.dev/icons/) icons from `lucide-static` through
the `Icon` component. Each icon is an SVG string that Astro inlines at build
time, so icons ship no client-side JavaScript. Don't copy SVG markup into
components.

```astro
---
import { LocateFixed } from "lucide-static";
import Icon from "../icon/Icon.astro";
---

<Icon icon={LocateFixed} />
<Icon icon={LocateFixed} size="sm" filled />
```

Icons are decorative (`aria-hidden`). Give icon-only buttons an `aria-label`.

### Rendering Dynamic Content

When a Web Component must show data (for example, details from an API),
render the markup in Astro and only fill in text from JavaScript. Use
`textContent` (never `innerHTML`) so data can't inject HTML. For repeated
items, render a `<template>` in Astro and clone it.

```astro
<aside class="details" hidden>
  <h2 class="name"></h2>
  <ul class="list"></ul>
</aside>
<template class="item-template">
  <li></li>
</template>
```

```javascript
panel.querySelector(".name").textContent = place.name;
```

## File Organization

### Monorepo Packages

This is a monorepo: every package lives in `packages/` and is a Bun
workspace (`@ev-maps/<name>`).

**🚨 Every artifact gets its own package.** An artifact is something we build
and ship on its own: the app, a Cloudflare Worker, a library we'd publish.

- **❌ NEVER put a Worker (or any other deployable) inside another package**,
  e.g. `packages/app/worker/`. Give it its own package, like
  `packages/worker`, with its own `package.json`, `wrangler.toml`,
  migrations and scripts (`dev`, `build`, `lint`, `format`, `format:check`).
- **Code shared by several packages goes in its own package** (like
  `packages/tiles`), which they depend on with `"workspace:*"` and import by
  name (`import { tileBounds } from "@ev-maps/tiles";`).
- **❌ NEVER import another package's files by relative path**
  (`../../app/src/...`); depend on the package instead.
- Each package has its dependencies in its own `package.json`. Only tooling
  used across the repository (linters, formatters, `concurrently`) lives in
  the root `package.json`.
- Give every new artifact a workflow; see [CI](CI.md).

### Component Structure

Generic UI components (buttons, icons, charts) are in their own package,
`packages/ui` (`@ev-maps/ui`): no app state, no translations, no API calls;
the page passes their text in. Import them by name:

```astro
---
import Button from "@ev-maps/ui/Button.astro";
import Icon from "@ev-maps/ui/Icon.astro";
---
```

Components that know about chargers, the map or the account stay in
`packages/app/src/components`. Either way, each Astro component has its own
directory:

```text
packages/ui/
├── button/
│   ├── Button.astro      # Template + logic
│   └── Button.css        # Styles
packages/app/src/components/
└── google-map/
    ├── GoogleMap.astro   # Template
    ├── GoogleMap.css     # Styles
    └── GoogleMap.js      # Behavior (a web component)
```

A new generic component goes in `packages/ui` with an entry in its
`package.json` `exports` and its README.

### Naming Conventions

- **Components**: PascalCase (e.g., `Button.astro`, `Map.astro`, `Card.astro`)
- **CSS files**: Match component name (e.g., `Button.css`, `Map.css`)
- **CSS classes**: kebab-case, no BEM (e.g., `.charger-details`, `.name`,
  `.primary`). See [Class Names](#class-names).
- **Variables**: camelCase (e.g., `buttonId`, `currentPosition`)
- **Props**: camelCase (e.g., `variant`, `disabled`, `onClick`)

## Domains: Keeping Changes Apart

Features are worked on in parallel, in stacked pull requests, so each one
should touch its own files. Where every feature has to register itself, it
adds **one line** to a list, never code to a shared function.

- **Worker routes**: a domain keeps its API routes (`routes`) and scheduled
  jobs (`jobs`) in its own module, and adds one line to
  `src/api-routes.js` or `src/jobs.js` (pages the Worker serves itself:
  `pageRoutes` and `src/page-routes.js`); see
  [The API](features/api.md). Never add an `if` to `src/index.js` or a
  policy to `src/guard.js`.
- **Translations**: each part of the site has its own section,
  `src/i18n/{language}/{section}.js`, e.g. `map`, `account`, and one per
  admin page (`admin-errors`, `admin-usage`); see [Languages](#languages).
- **Admin pages**: each is its own component and page, and adds one line to
  `src/components/admin-page/sections.js`, which builds the navigation and
  the overview.
- **Docs**: each feature has its own page in `docs/features/`;
  `ARCHITECTURE.md` only links to them.
- **Tests**: one spec file per feature in `packages/app/tests`, and tests
  next to the module in `packages/worker/src`.
- **Shared lists stay sorted** (imports, routes, sections), so two
  additions rarely land on the same line. Unavoidable shared files are
  `wrangler.toml` (bindings, rate limits) and database migrations, whose
  numbers must be unique: take the next free number when rebasing.

## Astro-Specific Guidelines

### Component Props

Always define props with TypeScript interfaces:

```astro
---
interface Props {
  title?: string;
  count: number;
  isActive?: boolean;
}

const { title = "Default", count, isActive = false } = Astro.props;
---
```

### Conditional Classes

Use Astro's `class:list` directive:

```astro
<div
  class:list={[
    "container",
    isActive && "active",
    size === "large" && "large",
  ]}
></div>
```

### Client-Side Interactivity

Put client-side code in a Web Component file next to the Astro component and
load it with a `<script src>` tag. Astro bundles it as a module and includes
it only once, even if the component is used several times:

```astro
<ev-locate-button>
  <Button variant="primary">Locate Me</Button>
  <script src="./LocateButton.js"></script>
</ev-locate-button>
```

Avoid `is:inline` scripts: they are not bundled, can't `import` other
modules, and are repeated for every component instance. The one exception is
the theme script in `Layout.astro`, which must run before the first paint so
the page doesn't flash the wrong theme.

### Slots

Use slots for composable components:

```astro
<!-- Card.astro -->
<div class="card">
  <div class="card-header">
    <slot name="header" />
  </div>
  <div class="card-body">
    <slot />
  </div>
  <div class="card-footer">
    <slot name="footer" />
  </div>
</div>

<!-- Usage -->
<Card>
  <h2 slot="header">Title</h2>
  <p>Content goes here</p>
  <button slot="footer">Action</button>
</Card>
```

## Languages

The site is in English, Polish and Hungarian. Every page is built once per
language, under its prefix (`/en/`, `/pl/`, `/hu/`), with Astro's i18n
routing.

**❌ NEVER write copy in JavaScript, in the Worker or in a component.** All
text lives in `src/i18n/{language}/{section}.js`, used only at build time;
the
build fails if a language is missing a key that English has.

- **Sections**: `common` (used on more than one kind of page, or by the
  layout), `map` (the map, filters, charger details, routes), `account` (the
  account menu, sign-in, favorites), `legal`, `admin` (with a section per
  admin page) and `email` (the Worker's emails). A new section is a file in
  each language plus a line in each `{language}/index.js`. Put a key in the
  section of the part of the site that uses it, so work on different parts
  doesn't touch the same files; if a second part starts using it, move it to
  `common`.
- **The client loads no i18n.** Each page's HTML carries only its
  language's and its sections' runtime messages, baked in by Astro at build
  time: the layout's `kind` prop (`map`, the default, `legal` or `admin`)
  picks them (`PAGE_SECTIONS` in `src/i18n/index.js`). A script asking
  for another
  section's message logs "Missing message", which
  `tests/translations.spec.js` catches.
- **Page text** (`page`): components read it with
  `translations(Astro.currentLocale).page`, and Astro renders it at build
  time.
- **Messages scripts show** (`messages`), e.g. statuses: Astro bakes the
  language's templates into the page, and scripts fill them in with
  `message(key, values)` from `src/lib/messages.js`. `{name}` is a
  placeholder. A message with a count has a form for each plural category of
  the language (`one`, `few`, `many`, `other` in Polish), and `message()`
  picks one with `Intl.PluralRules`.
- **Numbers, distances and units** are formatted with `Intl.NumberFormat` in
  the page's language, never by hand.
- **Values in the data** (access, status, connector types) are IDs; the
  Worker maps the sources' values to them (`packages/worker`'s
  `charger-values.js`), and `values` in each language file labels them. Names
  and addresses are shown as the source gives them.
- **Adding a language**: add it to `i18n.locales` in `astro.config.mjs`,
  create `src/i18n/{language}/` with every section and its `index.js`,
  and add it to `SECTIONS` in `src/i18n/index.js`. The Worker redirects
  `/` to it for browsers that
  prefer it, without changes.

```javascript
// ✅ Good
this.setStatus(message("chargersFound", { count: chargers.length }));

// ❌ Bad
this.setStatus(`${chargers.length} EV chargers found`);
```

## Code Quality

### Linting Rules

All linting and formatting tools are written in Rust. Shared configs live in
`packages/dev-config`; the tools are installed at the workspace root.

- **JavaScript**: [oxlint](https://oxc.rs/docs/guide/usage/linter)
  (`packages/dev-config/oxlint.json`). Key rules: `curly` (always use curly
  braces for all blocks), and `func-style`, `import/group-exports` and
  `import/exports-last` for
  [Functions and Exports](#functions-and-exports).
- **CSS**: [Biome](https://biomejs.dev/) (`packages/dev-config/biome.json`).
  In component CSS, the built-in `style/noHexColors` rule rejects hex
  colors, and the `no-disallowed-css-units` GritQL plugin from the
  `packages/biome-plugin-css-units` workspace rejects the units in its
  `$disallowed_units` list (currently px) outside custom property
  definitions; rem is allowed. Biome has no built-in rule for disallowed
  units yet; replace the plugin once it does.
- **Markdown**: [rumdl](https://rumdl.dev/)
  (`packages/dev-config/.rumdl.toml`), which uses markdownlint-compatible
  rules.

Run all linters from the repository root:

```bash
bun run lint
```

### Formatting Rules

This project uses [oxfmt](https://oxc.rs/docs/guide/usage/formatter)
(`packages/dev-config/.oxfmtrc.json`) for every file type in the repo:
Astro, JavaScript/TypeScript, CSS, JSON, Markdown and YAML. Astro support
needs `@astrojs/compiler-rs` (Astro's Rust compiler), which is a root dev
dependency. From the repository root:

```bash
bun run format        # write changes
bun run format:check  # verify only (used in CI)
```

## JavaScript Guidelines

### When to Use JavaScript

**✅ Use JavaScript for:**

- Event handlers
- DOM manipulation (when necessary)
- API calls
- State management
- Complex calculations

**❌ Do NOT use JavaScript for:**

- HTML templates
- CSS styles
- Static content
- Simple conditional rendering (use Astro directives instead)

### Functions and Exports

- **Functions are arrow functions assigned to a `const`**, never `function`
  declarations: `const loadScript = (src) => { ... };`. Class methods stay
  methods.
- **One export statement per file, at the end.** Don't export declarations
  inline (`export function`, `export const`, `export class`); declare them
  first, then list everything the file exports in a single
  `export { ... };`.
- Config files that a tool requires to have a default export (e.g.
  `astro.config.mjs`) keep their single `export default`.
- Astro pages export `getStaticPaths` inline (`export const getStaticPaths =
  ...`), as Astro requires; oxlint allows that in `src/pages`.

```javascript
// ✅ Good
const loadScript = (src) => {
  // ...
};

const loadGoogleMaps = (apiKey) => loadScript(mapsUrl(apiKey));

export { loadGoogleMaps, loadScript };
```

```javascript
// ❌ Bad
function loadScript(src) {
  // ...
}

export function loadGoogleMaps(apiKey) {
  return loadScript(mapsUrl(apiKey));
}

export const CALLBACK_NAME = "__evMapsGoogleMapsLoaded";
```

oxlint enforces this in CI with `func-style` (`expression`),
`import/group-exports` and `import/exports-last`.

### Event Handling

Attach listeners in `connectedCallback()` and scope DOM queries to the
component with `this.querySelector()`:

```javascript
connectedCallback() {
  this.querySelector('button')?.addEventListener('click', () =>
    this.handleClick()
  );
}
```

### Custom Events

Components communicate through bubbling custom events. Child components
dispatch, parent components listen:

```javascript
// Child (e.g. <ev-locate-button>)
this.dispatchEvent(
  new CustomEvent("location-found", {
    detail: { lat, lng },
    bubbles: true,
    composed: true,
  })
);

// Parent (e.g. <ev-google-map>)
this.addEventListener("location-found", (event) => {
  this.map.setCenter(event.detail);
});
```

## CSS Guidelines

### Global vs Component Styles

- **Global styles**: Place in `src/layouts/global.css`
- **Component styles**: Place in component-specific `.css` files

### Themes

The app supports a light and a dark theme. Users pick System, Light or Dark
in the account menu (`ThemePicker`), which sets `data-theme` on `<html>`
(no attribute means "follow the system").

- Define every color token once in `global.css` with both values, using
  `light-dark(light, dark)`. `color-scheme` on `:root` picks the value, so
  components never need theme-specific selectors.
- Use semantic tokens in components (`--color-surface`, `--color-text`,
  `--color-primary-light-text`) so both themes work without extra CSS.

```css
:root {
  --color-surface: light-dark(#ffffff, #0f172a);
}
```

### CSS Best Practices

1. **Use CSS variables** for colors and common values:

   ```css
   :root {
     --primary: #2563eb;
     --secondary: #7c3aed;
     --radius: 8px;
   }
   ```

2. **Combine short class names; don't use BEM**. See
   [Class Names](#class-names).

3. **Avoid deep nesting**: scope child classes under the component's block,
   one level deep where possible.

   ```css
   /* ❌ Bad */
   .charger-details .section .list .item .text {
   }

   /* ✅ Good */
   .charger-details {
     .text {
     }
   }
   ```

4. **Use utility classes** for common patterns:

   ```css
   .text-center {
     text-align: center;
   }
   .mt-4 {
     margin-top: 1.5rem;
   }
   .flex {
     display: flex;
   }
   ```

### Class Names

Don't use BEM (`block__element--modifier`). Combine short class names
instead:

- **Block**: the component's root element gets a descriptive, unique class,
  e.g. `.app-header` or `.charger-details`. Use a semantic tag for it where one
  fits (`<header>`, `<aside>`, `<form>`), but style the class, not the tag:
  all CSS is global, so `header { }` would style every header on the page.
- **Children**: short classes such as `.title`, `.subtitle` or `.name`,
  styled only through nesting under the block.
- **Modifiers**: extra classes on the same element, such as `.primary`,
  `.small` or `.active`, styled only in combination (`&.primary`). Never style
  a modifier on its own.
- Don't give a modifier the same name as another component's block class
  (e.g. a button size called `icon` would pick up the `Icon` component's
  `.icon` styles).

```astro
<header class="app-header">
  <h1 class="title">EV Maps</h1>
  <p class="subtitle">Find electric vehicle charging stations near you</p>
</header>

<button class="button primary small">Locate Me</button>
```

```css
.app-header {
  .title {
    font-weight: var(--font-weight-bold);
  }

  .subtitle {
    color: var(--color-text-muted);
  }
}

.button {
  &.primary {
    background: var(--color-primary);
  }

  &.small {
    font-size: var(--font-size-xs);
  }
}
```

```css
/* ❌ Bad - BEM */
.app-header__subtitle {
}
.button--primary {
}
```

## Performance Considerations

### Image Optimization

Use Astro's Image component or optimize images manually:

```astro
<img src={image} width="800" height="600" alt="Description" loading="lazy" />
```

### Minimize Client-Side JavaScript

- Use Astro for static content
- Only add Web Components where behavior is needed
- Load third-party scripts (e.g. Google Maps) on demand from the component
  that needs them

## Accessibility

### Semantic HTML

- Use appropriate HTML elements (`<button>`, `<nav>`, `<main>`, etc.)
- Proper heading hierarchy (`<h1>` to `<h6>`)
- Use ARIA attributes when needed

### Keyboard Navigation

- Ensure all interactive elements are keyboard-accessible
- Test tab order
- Provide visible focus indicators

### Screen Readers

- Use proper labels and descriptions
- Provide text alternatives for visual content
- Test with screen reader software

### Automated checks (axe)

- Every Playwright spec imports `test` and `expect` from
  `@ev-maps/e2e/test.js`, not `@playwright/test`. At the end of each
  passing test, axe checks the page against WCAG 2.1 A and AA, and any
  violation fails the test.
- `tests/accessibility.spec.js` also checks the main screens on the way, in
  both themes.
- Text needs 4.5:1 contrast: white text goes on the darker brand colors
  (`--color-primary-dark`, `--color-danger-dark`), and links in running text
  are underlined.
- A control's accessible name includes its visible text, so name it by its
  content (visually hidden text if needed) rather than `aria-label`.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/)
format:

```text
type(scope): description

body

footer
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring (no functional changes)
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `build`: Build system or dependency changes
- `ci`: CI configuration changes

### Examples

```text
feat(map): add location search functionality

- Add search input component
- Implement geocoding API integration
- Add search results display

Closes #123
```

```text
fix(button): correct disabled state styling

Button was not showing disabled cursor properly.
```

## Pull Request Guidelines

1. **Title**: Clear and descriptive
2. **Description**: Explain what and why
3. **Scope**: Keep PRs focused and small
4. **Testing**: Include screenshots or videos if UI changes
5. **Checklist**:

   - [ ] Code follows guidelines
   - [ ] Lint passes (`bun run lint`)
   - [ ] Formatting is correct (`bun run format`)
   - [ ] Tests pass
   - [ ] Documentation updated

## Additional Resources

- [Astro Documentation](https://astro.build/)
- [Astro Components](https://docs.astro.build/en/concepts/components/)
- [Bun Documentation](https://bun.sh/)
- [Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/)
