/**
 * LocateButton Web Component
 * Adds geolocation functionality to a button
 * Does NOT render HTML - only adds behavior to Astro-rendered button
 */
export class LocateButtonElement extends HTMLElement {
  connectedCallback() {
    const button = this.querySelector('button');
    
    if (button) {
      button.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('locate-click', {
          bubbles: true,
          composed: true
        }));
      });
    }
  }
}

customElements.define('ev-locate-button', LocateButtonElement);
