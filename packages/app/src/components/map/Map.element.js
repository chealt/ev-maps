/**
 * Map Web Component
 * Manages status display for map-related events
 * Does NOT render HTML - only adds behavior to Astro-rendered HTML
 */
export class MapElement extends HTMLElement {
  connectedCallback() {
    const statusEl = this.querySelector('.status');
    
    // Listen for location events from locate button
    this.addEventListener('locate-start', () => {
      if (statusEl) statusEl.textContent = 'Locating...';
    });
    
    this.addEventListener('location-found', (event) => {
      if (statusEl && event.detail) {
        statusEl.textContent = `Location: ${event.detail.lat.toFixed(4)}, ${event.detail.lng.toFixed(4)}`;
      }
    });
    
    this.addEventListener('location-error', (event) => {
      if (statusEl) {
        statusEl.textContent = event.detail?.message || 'Error locating';
      }
    });
    
    // Listen for filter events from filter button
    this.addEventListener('toggle-filters', () => {
      if (statusEl) statusEl.textContent = 'Filters clicked';
    });
  }
}

customElements.define('ev-map', MapElement);
