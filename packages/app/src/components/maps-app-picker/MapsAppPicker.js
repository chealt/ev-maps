import { mapsApp, onMapsAppChange, setMapsApp } from "../../lib/maps-app.js";

class MapsAppPickerElement extends HTMLElement {
  connectedCallback() {
    this.show(mapsApp());
    // Remembered in the details' dialog, or from the account.
    onMapsAppChange((app) => this.show(app));
    this.addEventListener("change", (event) => setMapsApp(event.target.value || null));
  }

  show(app) {
    const input = this.querySelector(`input[value="${app ?? ""}"]`);
    if (input) {
      input.checked = true;
    }
  }
}

customElements.define("ev-maps-app-picker", MapsAppPickerElement);

export { MapsAppPickerElement };
