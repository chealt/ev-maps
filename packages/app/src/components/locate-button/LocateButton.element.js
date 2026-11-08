/**
 * LocateButton Web Component
 * Adds geolocation functionality to a button
 * Does NOT render HTML - only adds behavior to Astro-rendered button
 */
export class LocateButtonElement extends HTMLElement {
  connectedCallback() {
    const button = this.querySelector('button');
    const statusEl = this.closest('[data-status]')?.querySelector('.status');
    
    if (button && statusEl) {
      button.addEventListener('click', () => {
        statusEl.textContent = 'Locating...';
        
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const coords = position.coords;
              statusEl.textContent = `Location: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
              
              this.dispatchEvent(new CustomEvent('location-found', {
                detail: { lat: coords.latitude, lng: coords.longitude },
                bubbles: true,
                composed: true
              }));
            },
            (error) => {
              statusEl.textContent = `Error: ${error.message}`;
              this.dispatchEvent(new CustomEvent('location-error', {
                detail: error,
                bubbles: true,
                composed: true
              }));
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        } else {
          statusEl.textContent = 'Geolocation not supported';
        }
      });
    }
  }
}

customElements.define('ev-locate-button', LocateButtonElement);
