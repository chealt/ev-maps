/**
 * EV Map Application - Main Web Component
 * Uses Astro's client directives for hydration
 */
export class EvMapApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          max-width: 800px;
          height: 500px;
          margin: 2rem 0;
        }
        .map-container {
          width: 100%;
          height: 100%;
          background-color: #f0f0f0;
          border-radius: 12px;
          border: 1px solid #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .map-placeholder {
          text-align: center;
          color: #888;
          padding: 2rem;
        }
        .map-placeholder h2 {
          margin-bottom: 0.5rem;
          color: #555;
        }
        .controls {
          position: absolute;
          top: 1rem;
          right: 1rem;
          display: flex;
          gap: 0.5rem;
          z-index: 100;
        }
        button {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        button:hover {
          background: #f5f5f5;
        }
      </style>
      <div class="map-container">
        <div class="map-placeholder">
          <h2>Map Loading...</h2>
          <p>EV charging stations will appear here</p>
        </div>
        <div class="controls">
          <button id="locate">Locate Me</button>
          <button id="filter">Filters</button>
        </div>
      </div>
    `;

    // Add event listeners
    this.shadowRoot.getElementById('locate')?.addEventListener('click', () => {
      this.handleLocate();
    });

    this.shadowRoot.getElementById('filter')?.addEventListener('click', () => {
      this.handleFilter();
    });
  }

  handleLocate() {
    console.log('Locate button clicked');
    // TODO: Implement geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Location:', position.coords);
          this.dispatchEvent(new CustomEvent('location-found', {
            detail: position.coords
          }));
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }

  handleFilter() {
    console.log('Filter button clicked');
    this.dispatchEvent(new CustomEvent('filter-requested'));
  }
}

customElements.define('ev-map-app', EvMapApp);
