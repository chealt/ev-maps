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

1. **Omit unnecessary constructor**: If your constructor only calls `super()`, remove it entirely. The default constructor from `HTMLElement` is sufficient.

   ```javascript
   // ✅ Good - No constructor needed
   export class MyElement extends HTMLElement {
     connectedCallback() {
       // Setup logic here
     }
   }
   
   // ❌ Bad - Unnecessary constructor
   export class MyElement extends HTMLElement {
     constructor() {
       super();
     }
     connectedCallback() {
       // Setup logic here
     }
   }
   ```

2. **Use `connectedCallback()` for initialization**: This is where you should set up event listeners and DOM references.

3. **Avoid `constructor` for DOM manipulation**: The element's DOM is not ready in the constructor. Use `connectedCallback()` instead.

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
