/**
 * Button Web Component Wrapper
 * Enhances button elements with custom functionality
 * Does NOT render HTML - only adds behavior to existing HTML
 */
export class ButtonElement extends HTMLElement {
  constructor() {
    super();
    // This element wraps existing button HTML from Astro
    // It does NOT create any HTML itself
  }

  connectedCallback() {
    // Find the button element inside this component
    const button = this.querySelector('button');
    if (button) {
      this.setupButton(button);
    }
  }

  setupButton(button) {
    // Add data attributes for easier targeting
    const action = this.getAttribute('data-action');
    if (action) {
      button.dataset.action = action;
    }

    // Add click handler
    button.addEventListener('click', (event) => {
      if (button.disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Dispatch custom event
      this.dispatchEvent(new CustomEvent('button-click', {
        detail: { action, originalEvent: event },
        bubbles: true,
        composed: true
      }));

      // Also dispatch action-specific event
      if (action) {
        this.dispatchEvent(new CustomEvent(`button-${action}`, {
          detail: { originalEvent: event },
          bubbles: true,
          composed: true
        }));
      }
    });
  }

  // Static method to register the component
  static register() {
    if (!customElements.get('ev-button')) {
      customElements.define('ev-button', ButtonElement);
    }
  }
}

// Auto-register when imported
ButtonElement.register();
