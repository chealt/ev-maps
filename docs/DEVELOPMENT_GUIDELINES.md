# Development Guidelines

This document outlines the coding standards and best practices for the EV Maps project.

## Core Principles

### 🚨 CRITICAL RULES

**✅ DO use Web Components as behavior wrappers for Astro-rendered HTML.**

**✅ Astro renders HTML/CSS, Web Components add client-side behavior only.**

**❌ NEVER create HTML or CSS inside Web Component JavaScript files.**

**❌ NEVER inline HTML or CSS in JavaScript files.**

**❌ NEVER use shadow DOM in Web Components (unless explicitly approved).**

### Architecture Pattern

**Create Web Components ONLY for specific custom functionality, not for generic abstractions.**

```
Component Structure:
├── button/
│   ├── Button.astro      # Renders HTML + imports CSS (generic, reusable)
│   └── Button.css        # Styles only
└── map/
    ├── Map.astro         # Renders HTML + imports CSS
    ├── Map.css           # Styles only
    └── Map.element.js    # Web Component - specific functionality only
```

**How it works:**
1. Astro renders the HTML template with CSS
2. Web Component (`*.element.js`) adds **specific** client-side functionality
3. Web Component does NOT create any HTML - it only adds behavior to existing HTML
4. **Do NOT create Web Components for generic elements like buttons** - only for components with specific functionality

### Web Component Best Practices

1. **Omit unnecessary constructor**: If your constructor only calls `super()`, remove it entirely.

2. **Naming convention**: Use simple, descriptive names for Web Component files. Do NOT use `.element.js` suffix - it's redundant. Use `ComponentName.js` directly.

3. **Self-contained components**: Each Web Component should be wrapped in an Astro component that includes its script via `<script src="...">`. This makes components composable and ensures scripts are only loaded when the component is used.

   ```astro
   <!-- LocateButton.astro -->
   <ev-locate-button>
     <Button variant="primary">Locate Me</Button>
     <script src="/src/components/locate-button/LocateButton.js"></script>
   </ev-locate-button>
   ```

4. **Use `<script src="...">` not module imports**: For Web Component scripts, use regular script tags with src attributes. Astro will handle them as modules automatically. This is simpler and more reliable than using `import` statements in script tags.

   ```astro
   <!-- ✅ Good -->
   <script src="/src/components/map/Map.js"></script>
   
   <!-- ❌ Bad -->
   <script type="module">
     import '../components/map/Map.js';
   </script>
   ```

5. **No global script loading**: Do NOT load Web Component scripts in Layout.astro or other global files. Load them in the Astro component that uses them, so they're only loaded when needed.

6. **No global CSS imports**: Do NOT import CSS files in Layout.astro or other global files. Each component should import its own CSS in its Astro file. This ensures CSS is only loaded when the component is used.

   ```astro
   <!-- Button.astro -->
   ---
   import './Button.css';
   ---
   
   <button class="button">...</button>
   ```

7. **CSS co-located with components**: Place CSS files in the same directory as the component that uses them. Global CSS should be in the layouts directory and imported in Layout.astro. All CSS files should be in the src directory and imported where needed.

8. **Global CSS only for truly global styles**: The global.css file should only contain CSS variables, base element styles, and utility classes. Component-specific styles should be in the component's CSS file, not in global.css.

9. **Use CSS variables for all values**: All colors, fonts, font sizes, widths, heights, gaps, borders, z-indexes, opacity, transitions, and other style values should be defined as CSS variables in global.css and used throughout the application. This ensures consistency and makes theming easier. **No hardcoded values allowed in component CSS files.**

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
   - Typography: `--font-family`, `--font-size-*`, `--font-weight-*`, `--line-height-*`
   - Spacing: `--spacing-xs`, `--spacing-sm`, `--spacing-md`, etc.
   - Borders: `--border-radius-*`, `--border-width`
   - Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`
   - Z-indexes: `--z-dropdown`, `--z-sticky`, `--z-fixed`, `--z-modal`
   - Opacity: `--opacity-disabled`, `--opacity-background`, etc.
   - Transitions: `--transition-fast`, etc.
   - Layout: `--container-max-width`, `--container-padding`, `--map-height`, etc.

10. **Use CSS nesting**: Use CSS nesting (native browser feature) to organize related styles and reduce repetition. This makes CSS more maintainable and easier to read.

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

8. **Minimal comments**: Write self-documenting code. Avoid comments that just repeat what the code does. Use descriptive names for functions, variables, and classes instead of adding comments.

9. **Inline class names in Astro**: Don't use array join for class names. Use template literals directly in the class attribute for better readability.

   ```astro
   <!-- ✅ Good - inline template literal -->
   <button class={`button button--${variant} button--${size}${disabled ? ' button--disabled' : ''}`}>
     <slot />
   </button>
   
   <!-- ❌ Bad - array join -->
   <button class={['button', `button--${variant}`, `button--${size}`, disabled ? 'button--disabled' : ''].filter(Boolean).join(' ')}>
     <slot />
   </button>
   ```

   ```javascript
   // ✅ Good - self-documenting
   handleLocationFound(statusEl, event) {
     if (statusEl && event.detail) {
       statusEl.textContent = `Location: ${event.detail.lat}, ${event.detail.lng}`;
     }
   }
   
   // ❌ Bad - redundant comment
   /**
    * Handles location found event
    * Updates status element with location
    */
   handleLocationFound(statusEl, event) {
     if (statusEl && event.detail) {
       statusEl.textContent = `Location: ${event.detail.lat}, ${event.detail.lng}`;
     }
   }
   ```

   ```
   ✅ Good:
   components/
   └── locate-button/
       └── LocateButton.js
   
   ❌ Bad:
   components/
   └── locate-button/
       └── LocateButton.element.js  # Redundant suffix
   ``` The default constructor from `HTMLElement` is sufficient.

2. **Use `connectedCallback()` for initialization**: This is where you should set up event listeners and DOM references.

---

### ✅ Example: Map Component with Geolocation

**Button.astro** (Generic reusable button - NO Web Component):
```astro
---
interface Props {
  variant?: 'primary' | 'secondary';
  dataAction?: string;  // For event delegation
}
const { variant = 'primary', dataAction } = Astro.props;
---

<button 
  class:list={['button', `button--${variant}`]}
  ?data-action={dataAction}
>
  <slot />
</button>
```

**Map.astro** (Renders HTML):
```astro
---
import Button from '../button/Button.astro';
---

<ev-map>
  <div class="map-container">
    <div class="map-placeholder">
      <h2>EV Charging Stations</h2>
    </div>
    <div class="controls">
      <Button variant="primary" dataAction="locate">Locate Me</Button>
      <Button variant="secondary" dataAction="filters">Filters</Button>
    </div>
    <div class="status"></div>
  </div>
</ev-map>
```

**Map.element.js** (Specific functionality - geolocation):
```javascript
// Web Component with SPECIFIC functionality
export class MapElement extends HTMLElement {
  connectedCallback() {
    const locateBtn = this.querySelector('[data-action="locate"]');
    const filterBtn = this.querySelector('[data-action="filters"]');
    const statusEl = this.querySelector('.status');
    
    // Specific: Handle geolocation
    locateBtn?.addEventListener('click', () => {
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
    filterBtn?.addEventListener('click', () => {
      statusEl.textContent = 'Showing filters';
    });
  }
}
customElements.define('ev-map', MapElement);
```

**Result:**
- Astro renders all HTML and CSS
- `ev-map` Web Component adds **specific** geolocation functionality
- Buttons are just Astro components - no generic Web Component wrapper needed
- No HTML/CSS in JavaScript!

---

## Component Architecture

### ✅ Recommended Pattern (Astro Components)

This project uses **Astro components**, not Web Components. Each component should have:

```
components/
└── button/
    ├── Button.astro      # HTML template + Astro logic
    └── Button.css        # Styles only
```

**Button.astro:**
```astro
---
// Frontmatter: TypeScript/JavaScript logic
interface Props {
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}
const { variant = 'primary', disabled = false } = Astro.props;
const buttonId = Astro.id;
---

<!-- HTML Template -->
<button 
  class:list={['button', `button--${variant}`, disabled && 'button--disabled']}
  id={buttonId}
  disabled={disabled}
>
  <slot />
</button>

<!-- Client-side JavaScript (ONLY if needed) -->
<script is:inline>
  // ONLY custom functionality here
  // NO HTML or CSS!
  const btn = document.getElementById('<?= buttonId ?>');
  btn?.addEventListener('click', () => {
    console.log('Button clicked');
  });
</script>
```

**Button.css:**
```css
/* Only CSS styles here */
.button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.button--primary {
  background: #2563eb;
  color: white;
}

.button--secondary {
  background: #f1f5f9;
  color: #1e293b;
}

.button--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

### ❌ Anti-Patterns (DO NOT DO)

#### 1. Web Components with HTML/CSS in JS
```javascript
// ❌ BAD - Never do this!
class Button extends HTMLElement {
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        button { padding: 0.5rem 1rem; }
      </style>
      <button><slot></slot></button>
    `;
  }
}
customElements.define('my-button', Button);
```

#### 2. Inline HTML/CSS in JavaScript
```javascript
// ❌ BAD - Never do this!
function renderButton() {
  const div = document.createElement('div');
  div.innerHTML = `
    <style>
      .btn { color: red; }
    </style>
    <button class="btn">Click</button>
  `;
  return div;
}
```

#### 3. Inline styles in Astro templates
```astro
<!-- ❌ BAD - Avoid inline styles -->
<button style="padding: 0.5rem; background: blue; color: white;">
  Click
</button>
```

---

## File Organization

### Component Structure

Each Astro component should have its own directory:

```
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
- **CSS classes**: kebab-case (e.g., `.button`, `.button--primary`, `.map-container`)
- **Variables**: camelCase (e.g., `buttonId`, `currentPosition`)
- **Props**: camelCase (e.g., `variant`, `disabled`, `onClick`)

---

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

const { title = 'Default', count, isActive = false } = Astro.props;
---
```

### Conditional Classes

Use Astro's `class:list` directive:

```astro
<div class:list={[
  'container',
  isActive && 'container--active',
  size === 'large' && 'container--large'
]}>
</div>
```

### Client-Side Interactivity

Use `is:inline` scripts for client-side functionality:

```astro
<script is:inline>
  // This runs in the browser
  const element = document.getElementById('my-element');
  element.addEventListener('click', () => {
    console.log('Clicked');
  });
</script>
```

For reusable client-side code, create separate `.js` files and import them:

```astro
<script is:inline>
  import { initMap } from '../utils/map.js';
  initMap();
</script>
```

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

---

## Code Quality

### Linting Rules

This project uses [oxlint](https://github.com/oxc-project/oxlint) for JavaScript/TypeScript linting and [lightningcss](https://github.com/parcel-bundler/lightningcss) for CSS linting.

**JavaScript Linting:**
- Uses oxlint (Rust-based, very fast)
- Key rule: `curly: error` - Always use curly braces `{}` for all blocks
- Full configuration in `packages/dev-config/oxlint.json`

**CSS Linting:**
- Uses lightningcss (Rust-based, very fast)
- Run with: `bun run lint:css` from dev-config package

Run JavaScript linting from the app package:
```bash
cd packages/app && bun run lint
```

Run CSS linting:
```bash
cd packages/dev-config && bun run lint:css
```

### Formatting Rules

This project uses [oxfmt](https://github.com/oxc-project/oxfmt) for code formatting.

Run formatting from the app package:
```bash
cd packages/app && bun run format
```

Or from the root:
```bash
cd packages/app && bun run --cwd . format
```

---

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

```astro
<script is:inline>
  const button = document.getElementById('my-button');
  
  button.addEventListener('click', (event) => {
    event.preventDefault();
    // Handle click
    console.log('Button clicked');
  });
</script>
```

### Custom Events

Dispatch custom events for component communication:

```astro
<script is:inline>
  const container = document.getElementById('my-container');
  
  container.addEventListener('custom-event', (event) => {
    console.log('Received:', event.detail);
  });
  
  // Dispatch event
  container.dispatchEvent(new CustomEvent('custom-event', {
    detail: { data: 'value' },
    bubbles: true
  }));
</script>
```

---

## CSS Guidelines

### Global vs Component Styles

- **Global styles**: Place in `src/styles/global.css`
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
   .button {}              /* Block */
   .button--primary {}     /* Modifier */
   .button__icon {}        /* Element */
   ```

3. **Avoid deep nesting**:
   ```css
   /* ❌ Bad */
   .parent .child .grandchild {}
   
   /* ✅ Good */
   .grandchild {}
   ```

4. **Use utility classes** for common patterns:
   ```css
   .text-center { text-align: center; }
   .mt-4 { margin-top: 1.5rem; }
   .flex { display: flex; }
   ```

---

## Performance Considerations

### Lazy Loading

Use Astro's dynamic imports for code splitting:

```astro
---
const Module = await import('../heavy-module.js');
---
```

### Image Optimization

Use Astro's Image component or optimize images manually:

```astro
<img src={image} width="800" height="600" alt="Description" loading="lazy" />
```

### Minimize Client-Side JavaScript

- Use Astro for static content
- Only hydrate what's necessary
- Use `is:inline` for small scripts
- Use `is:load` for scripts that can wait

---

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

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
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

```
feat(map): add location search functionality

- Add search input component
- Implement geocoding API integration
- Add search results display

Closes #123
```

```
fix(button): correct disabled state styling

Button was not showing disabled cursor properly.
```

---

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

---

## Additional Resources

- [Astro Documentation](https://astro.build/)
- [Astro Components](https://docs.astro.build/en/concepts/components/)
- [Bun Documentation](https://bun.sh/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
