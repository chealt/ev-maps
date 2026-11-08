/**
 * LocateButton Web Component
 * Handles geolocation functionality for a button
 */
export class LocateButtonElement extends HTMLElement {
  connectedCallback() {
    const button = this.querySelector('button');
    
    if (button) {
      button.addEventListener('click', () => this.handleClick());
    }
  }

  handleClick() {
    this.dispatchEvent(new CustomEvent('locate-start', {
      bubbles: true,
      composed: true
    }));
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => this.handleSuccess(position),
        (error) => this.handleError(error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      this.handleError(new Error('Geolocation not supported'));
    }
  }

  handleSuccess(position) {
    const coords = position.coords;
    this.dispatchEvent(new CustomEvent('location-found', {
      detail: { lat: coords.latitude, lng: coords.longitude },
      bubbles: true,
      composed: true
    }));
  }

  handleError(error) {
    this.dispatchEvent(new CustomEvent('location-error', {
      detail: error,
      bubbles: true,
      composed: true
    }));
  }
}

customElements.define('ev-locate-button', LocateButtonElement);
