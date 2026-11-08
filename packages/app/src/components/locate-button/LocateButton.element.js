/**
 * LocateButton Web Component
 * Handles geolocation functionality for a button
 * Does NOT render HTML - only adds behavior to Astro-rendered button
 */
export class LocateButtonElement extends HTMLElement {
  connectedCallback() {
    const button = this.querySelector('button');
    
    if (button) {
      button.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('locate-start', {
          bubbles: true,
          composed: true
        }));
        
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const coords = position.coords;
              this.dispatchEvent(new CustomEvent('location-found', {
                detail: { lat: coords.latitude, lng: coords.longitude },
                bubbles: true,
                composed: true
              }));
            },
            (error) => {
              this.dispatchEvent(new CustomEvent('location-error', {
                detail: error,
                bubbles: true,
                composed: true
              }));
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        } else {
          this.dispatchEvent(new CustomEvent('location-error', {
            detail: new Error('Geolocation not supported'),
            bubbles: true,
            composed: true
          }));
        }
      });
    }
  }
}

customElements.define('ev-locate-button', LocateButtonElement);
