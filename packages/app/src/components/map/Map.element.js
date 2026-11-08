/**
 * Map Web Component
 * Handles map-specific functionality:
 * - Listens to button clicks
 * - Manages status display
 * - Handles geolocation
 * Does NOT render HTML - only adds behavior to Astro-rendered HTML
 */
export class MapElement extends HTMLElement {
  connectedCallback() {
    const statusEl = this.querySelector('.status');
    
    // Listen for locate button clicks
    this.addEventListener('locate-click', () => {
      this.handleLocate(statusEl);
    });
    
    // Listen for filter button clicks
    this.addEventListener('filter-click', () => {
      this.handleFilters(statusEl);
    });
  }

  handleLocate(statusEl) {
    if (statusEl) {
      statusEl.textContent = 'Locating...';
    }
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = position.coords;
          if (statusEl) {
            statusEl.textContent = `Location: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
          }
          
          this.dispatchEvent(new CustomEvent('location-found', {
            detail: { lat: coords.latitude, lng: coords.longitude },
            bubbles: true,
            composed: true
          }));
        },
        (error) => {
          if (statusEl) {
            statusEl.textContent = `Error: ${error.message}`;
          }
          this.dispatchEvent(new CustomEvent('location-error', {
            detail: error,
            bubbles: true,
            composed: true
          }));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else if (statusEl) {
      statusEl.textContent = 'Geolocation not supported';
    }
  }

  handleFilters(statusEl) {
    if (statusEl) {
      statusEl.textContent = 'Filters clicked';
    }
    this.dispatchEvent(new CustomEvent('toggle-filters', {
      bubbles: true,
      composed: true
    }));
  }
}

customElements.define('ev-map', MapElement);
