/**
 * EV Map Application - Main Web Component
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
          height: 100vh;
          margin: 0;
          padding: 0;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .container {
          width: 100%;
          height: 100%;
          background-color: #f5f5f5;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        h1 {
          color: #333;
          margin-bottom: 1rem;
        }
        .map-placeholder {
          width: 80%;
          height: 60%;
          background-color: #e0e0e0;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
        }
      </style>
      <div class="container">
        <h1>EV Maps</h1>
        <p>Electric Vehicle Charging Station Map</p>
        <div class="map-placeholder">
          Map will be rendered here
        </div>
      </div>
    `;
  }
}

customElements.define('ev-map-app', EvMapApp);
