/**
 * Map Web Component Wrapper
 * Enhances map container with client-side functionality
 * Does NOT render HTML - only adds behavior to existing HTML from Astro
 */
export class MapElement extends HTMLElement {
  constructor() {
    super();
    // This element wraps existing map HTML from Astro
    // It does NOT create any HTML itself
  }

  connectedCallback() {
    const statusEl = this.querySelector('.status');
    
    // Listen for button-click events from child ev-button elements
    this.addEventListener('button-click', (event) => {
      const action = event.detail?.action;
      
      switch (action) {
        case 'locate':
          this.handleLocate(statusEl);
          break;
        case 'filters':
          this.handleFilters(statusEl);
          break;
        default:
          console.log('Button clicked:', action);
      }
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
          
          // Dispatch custom event
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

  // Static method to register the component
  static register() {
    if (!customElements.get('ev-map')) {
      customElements.define('ev-map', MapElement);
    }
  }
}

// Auto-register when imported
MapElement.register();
