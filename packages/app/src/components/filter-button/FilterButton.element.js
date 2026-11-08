/**
 * FilterButton Web Component
 * Adds filter toggle functionality to a button
 * Does NOT render HTML - only adds behavior to Astro-rendered button
 */
export class FilterButtonElement extends HTMLElement {
  connectedCallback() {
    const button = this.querySelector('button');
    
    if (button) {
      button.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('filter-click', {
          bubbles: true,
          composed: true
        }));
      });
    }
  }
}

customElements.define('ev-filter-button', FilterButtonElement);
