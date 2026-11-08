/**
 * Map Application - Main Web Component
 * 
 * IMPORTANT: Do NOT inline HTML or CSS in JavaScript files.
 * Always use separate .html and .css files.
 */

// Import HTML template
import template from './app.html?raw';

// Import CSS
import './app.css';

class MapApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = template;

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

export { MapApp };
