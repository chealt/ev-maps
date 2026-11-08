/**
 * FilterButton Web Component
 * Adds filter toggle functionality to a button
 * Does NOT render HTML - only adds behavior to Astro-rendered button
 */
export class FilterButtonElement extends HTMLElement {
  connectedCallback() {
    const button = this.querySelector('button');
    const statusEl = this.closest('[data-status]')?.querySelector('.status');
    
    if (button && statusEl) {
      button.addEventListener('click', () => {
        statusEl.textContent = 'Filters clicked';
        
        this.dispatchEvent(new CustomEvent('toggle-filters', {
          bubbles: true,
          composed: true
        }));
      });
    }
  }
}

customElements.define('ev-filter-button', FilterButtonElement);
