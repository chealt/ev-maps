/**
 * Map Web Component
 * Manages status display for map-related events
 */
export class MapElement extends HTMLElement {
  connectedCallback() {
    const statusEl = this.querySelector('.status');
    
    this.addEventListener('locate-start', () => this.handleLocateStart(statusEl));
    this.addEventListener('location-found', (event) => this.handleLocationFound(statusEl, event));
    this.addEventListener('location-error', (event) => this.handleLocationError(statusEl, event));
    this.addEventListener('toggle-filters', () => this.handleToggleFilters(statusEl));
  }

  handleLocateStart(statusEl) {
    if (statusEl) statusEl.textContent = 'Locating...';
  }

  handleLocationFound(statusEl, event) {
    if (statusEl && event.detail) {
      statusEl.textContent = `Location: ${event.detail.lat.toFixed(4)}, ${event.detail.lng.toFixed(4)}`;
    }
  }

  handleLocationError(statusEl, event) {
    if (statusEl) {
      statusEl.textContent = event.detail?.message || 'Error locating';
    }
  }

  handleToggleFilters(statusEl) {
    if (statusEl) statusEl.textContent = 'Filters clicked';
  }
}

customElements.define('ev-map', MapElement);
