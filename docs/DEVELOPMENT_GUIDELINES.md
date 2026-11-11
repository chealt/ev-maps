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
   **No hardcoded values allowed in component CSS files**, except where a
   custom property is defined.

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
     --button-pressed-scale: 0.97;

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

      &--disabled {
        opacity: var(--opacity-disabled);
      }
    }

    /* ❌ Bad - flat selectors */
    .button {
      background: var(--color-primary);
    }
    .button:hover {
      background: var(--color-primary-dark);
    }
    .button--disabled {
      opacity: var(--opacity-disabled);
    }
    ```

11. **Minimal comments**: Write self-documenting code. Avoid comments that
    just repeat what the code does. Use descriptive names for functions,
    variables, and classes instead of adding comments.

    ```astro
    <!-- ✅ Good - Astro's class:list -->
    <button class:list={["button", `button--${variant}`, `button--${size}`]}>
      <slot />
    </button>

    <!-- ❌ Bad - manual array join -->
    <button
      class={["button", `button--${variant}`, `button--${size}`]
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

<button class:list={["button", `button--${variant}`]} data-action={dataAction}>
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
export class MapElement extends HTMLElement {
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
  class:list={["button", `button--${variant}`, className]}
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

### Rendering Dynamic Content

When a Web Component must show data (for example, details from an API),
render the markup in Astro and only fill in text from JavaScript. Use
`textContent` (never `innerHTML`) so data can't inject HTML. For repeated
items, render a `<template>` in Astro and clone it.

```astro
<aside class="details" hidden>
  <h2 class="details__name"></h2>
  <ul class="details__list"></ul>
</aside>
<template class="details__item-template">
  <li></li>
</template>
```

```javascript
panel.querySelector(".details__name").textContent = place.name;
```

## File Organization

### Component Structure

Each Astro component should have its own directory:

```text
components/
├── button/
│   ├── Button.astro      # Template + logic
│   └── Button.css        # Styles
├── map/
│   ├── Map.astro         # Template + logic
│   └── Map.css           # Styles
└── card/
    ├── Card.astro        # Template + logic
    └── Card.css          # Styles
```

### Naming Conventions

- **Components**: PascalCase (e.g., `Button.astro`, `Map.astro`, `Card.astro`)
- **CSS files**: Match component name (e.g., `Button.css`, `Map.css`)
- **CSS classes**: kebab-case (e.g., `.button`, `.button--primary`,
  `.map-container`)
- **Variables**: camelCase (e.g., `buttonId`, `currentPosition`)
- **Props**: camelCase (e.g., `variant`, `disabled`, `onClick`)

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
    isActive && "container--active",
    size === "large" && "container--large",
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
modules, and are repeated for every component instance.

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

## Code Quality

### Linting Rules

All linting and formatting tools are written in Rust. Shared configs live in
`packages/dev-config`; the tools are installed at the workspace root.

- **JavaScript**: [oxlint](https://oxc.rs/docs/guide/usage/linter)
  (`packages/dev-config/oxlint.json`). Key rule: `curly: error` - always use
  curly braces for all blocks.
- **CSS**: [Biome](https://biomejs.dev/) (`packages/dev-config/biome.json`).
  A GritQL plugin (`packages/dev-config/no-hardcoded-css-values.grit`)
  rejects hardcoded colors and px/rem values in component CSS, except in
  custom property definitions.
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

### CSS Best Practices

1. **Use CSS variables** for colors and common values:

   ```css
   :root {
     --primary: #2563eb;
     --secondary: #7c3aed;
     --radius: 8px;
   }
   ```

2. **Use BEM-like naming**:

   ```css
   .button {
   } /* Block */
   .button--primary {
   } /* Modifier */
   .button__icon {
   } /* Element */
   ```

3. **Avoid deep nesting**:

   ```css
   /* ❌ Bad */
   .parent .child .grandchild {
   }

   /* ✅ Good */
   .grandchild {
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
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
