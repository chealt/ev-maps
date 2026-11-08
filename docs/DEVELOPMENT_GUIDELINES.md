# Development Guidelines

This document outlines the coding standards and best practices for the EV Maps project.

## Core Principles

### Separation of Concerns

⚠️ **DO NOT** inline HTML or CSS in JavaScript files.

This project follows a strict separation of concerns:
- **HTML** belongs in `.html` files
- **CSS** belongs in `.css` files  
- **JavaScript** belongs in `.js` files

### Why This Matters

- **Maintainability**: Easier to read, update, and debug
- **Tooling**: Better syntax highlighting, linting, and IDE support
- **Performance**: Better caching and bundling
- **Collaboration**: Clearer code structure for team members

---

## Component Architecture

### ✅ Recommended Pattern

```javascript
// MapApp.js
import template from "./MapApp.html?raw";
import "./MapApp.css";

export class MapApp extends HTMLElement {
  render() {
    this.shadowRoot.innerHTML = template;
  }
}
```

```html
<!-- MapApp.html -->
<div class="map-container">
  <slot></slot>
</div>
```

```css
/* MapApp.css */
.map-container {
  display: block;
  width: 100%;
}
```

### ❌ Anti-Pattern (Avoid)

```javascript
// BAD - Inline HTML and CSS
render() {
  this.shadowRoot.innerHTML = `
    <style>
      .map-container {
        display: block;
        width: 100%;
      }
    </style>
    <div class="map-container">
      <slot></slot>
    </div>
  `;
}
```

---

## File Organization

### Component Structure

Each Web Component should have its own directory with:

```
components/
└── MyComponent/
    ├── MyComponent.js      # JavaScript logic
    ├── MyComponent.html    # HTML template
    └── MyComponent.css     # Styles
```

### Naming Conventions

- **Components**: PascalCase (e.g., `MapApp.js`, `LocationSearch.js`)
- **Files**: kebab-case for non-component files (e.g., `utils.js`, `api-client.js`)
- **CSS classes**: kebab-case (e.g., `.map-container`, `.search-input`)
- **Variables**: camelCase (e.g., `mapElement`, `currentLocation`)

---

## Code Quality

### Linting

This project uses [oxlint](https://github.com/oxc-project/oxlint) for linting.

```bash
# Run linter
bun run lint

# Fix lint issues (where possible)
bun run lint --fix
```

### Formatting

This project uses [oxfmt](https://github.com/oxc-project/oxfmt) for code formatting.

```bash
# Format all files
bun run format

# Check formatting without applying changes
bun run format:check
```

### Pre-commit Hooks

Consider setting up pre-commit hooks to automatically run linting and formatting:

```bash
# Example .git/hooks/pre-commit (make it executable)
#!/bin/sh
bun run lint
bun run format:check
```

---

## Testing Guidelines

### Unit Tests

- Test individual functions and utilities
- Use descriptive test names
- Keep tests focused and fast

### Integration Tests

- Test component interactions
- Mock external dependencies
- Test edge cases

### End-to-End Tests

- Test user flows
- Use realistic data
- Test on multiple browsers/devices

---

## Performance Considerations

### Bundle Size

- Minimize third-party dependencies
- Use tree-shaking where possible
- Lazy-load non-critical components

### Rendering

- Use efficient selectors
- Minimize DOM manipulations
- Batch DOM updates when possible

### Assets

- Optimize images
- Use modern formats (WebP, AVIF)
- Implement lazy loading

---

## Accessibility

### Semantic HTML

- Use appropriate HTML elements
- Proper heading hierarchy
- ARIA attributes when needed

### Keyboard Navigation

- Ensure all interactive elements are keyboard-accessible
- Test tab order
- Provide visible focus indicators

### Screen Readers

- Use proper labels and descriptions
- Test with screen reader software
- Provide text alternatives for visual content

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
fix(styles): correct z-index issue in modal

Modal was appearing behind other elements due to incorrect z-index value.
```

---

## Pull Request Guidelines

1. **Title**: Clear and descriptive
2. **Description**: Explain what and why
3. **Scope**: Keep PRs focused and small
4. **Testing**: Include screenshots or videos if UI changes
5. **Checklist**:
   - [ ] Code follows guidelines
   - [ ] Lint passes
   - [ ] Formatting is correct
   - [ ] Tests pass
   - [ ] Documentation updated

---

## Version Control

### Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual feature branches
- `fix/*`: Bug fix branches
- `release/*`: Release preparation branches

### Merge Strategy

- Prefer **rebase and merge** for clean history
- Use **squash and merge** for small fixes
- Avoid **merge commits** for feature branches

---

## Additional Resources

- [Astro Documentation](https://astro.build/)
- [Web Components Guide](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
- [Bun Documentation](https://bun.sh/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
