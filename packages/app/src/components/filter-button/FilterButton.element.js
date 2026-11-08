/**
 * FilterButton Web Component
 * Handles filter toggle functionality for a button
 * Does NOT render HTML - only adds behavior to Astro-rendered button
 */
export class FilterButtonElement extends HTMLElement {
  connectedCallback() {
    const button = this.querySelector('button');
    
    if (button) {
      button.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('toggle-filters', {
          bubbles: true,
          composed: true
        }));
      });
    }
  }
}

customElements.define('ev-filter-button', FilterButtonElement);
