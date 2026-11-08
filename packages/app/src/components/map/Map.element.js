/**
 * Map Web Component
 * Adds client-side functionality to the map:
 * - Geolocation for "Locate Me" button
 * - Filter toggle for "Filters" button
 * Does NOT render HTML - only adds behavior to Astro-rendered HTML
 */
export class MapElement extends HTMLElement {
  constructor() {
    super();
    // This element wraps existing HTML from Astro
    // It does NOT create any HTML itself
  }

  connectedCallback() {
    const mapContainer = this.querySelector('.map-container');
    const statusEl = this.querySelector('.status');
    
    // Find buttons by data-action attribute
    const locateBtn = this.querySelector('[data-action="locate"]');
    const filterBtn = this.querySelector('[data-action="filters"]');
    
    // Setup locate button
    if (locateBtn && statusEl) {
      locateBtn.addEventListener('click', () => {
        this.handleLocate(statusEl, mapContainer);
      });
    }
    
    // Setup filter button
    if (filterBtn && statusEl) {
      filterBtn.addEventListener('click', () => {
        this.handleFilters(statusEl, mapContainer);
      });
    }
  }

  handleLocate(statusEl, mapContainer) {
    statusEl.textContent = 'Locating...';
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = position.coords;
          statusEl.textContent = `Location: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
          
          // Dispatch custom event
          mapContainer?.dispatchEvent(new CustomEvent('location-found', {
            detail: { lat: coords.latitude, lng: coords.longitude },
            bubbles: true,
            composed: true
          }));
          
          this.dispatchEvent(new CustomEvent('location-found', {
            detail: { lat: coords.latitude, lng: coords.longitude },
            bubbles: true,
            composed: true
          }));
        },
        (error) => {
          statusEl.textContent = `Error: ${error.message}`;
          mapContainer?.dispatchEvent(new CustomEvent('location-error', {
            detail: error,
            bubbles: true,
            composed: true
          }));
          
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
  }

  handleFilters(statusEl, mapContainer) {
    statusEl.textContent = 'Filters clicked';
    
    mapContainer?.dispatchEvent(new CustomEvent('toggle-filters', {
      bubbles: true,
      composed: true
    }));
    
    this.dispatchEvent(new CustomEvent('toggle-filters', {
      bubbles: true,
      composed: true
    }));
  }

  // Static method to register the component
  static register() {
    if (!customElements.get('ev-map')) {
      customElements.define('ev-map', MapElement);
    }
  }
}

// Auto-register when imported
MapElement.register();
