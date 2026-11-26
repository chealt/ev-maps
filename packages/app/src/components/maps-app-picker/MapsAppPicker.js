import { mapsApp, onMapsAppChange, setMapsApp } from "../../lib/maps-app.js";

class MapsAppPickerElement extends HTMLElement {
  connectedCallback() {
    this.show(mapsApp());
    // Chosen on another device, from the account; none is Google Maps.
    onMapsAppChange((app) => this.show(app ?? "google"));
    this.addEventListener("change", (event) => setMapsApp(event.target.value));
  }

  show(app) {
    const input = this.querySelector(`input[value="${app}"]`);
    if (input) {
      input.checked = true;
    }
  }
}

customElements.define("ev-maps-app-picker", MapsAppPickerElement);

export { MapsAppPickerElement };
