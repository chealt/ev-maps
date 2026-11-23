import {
  chosenDistanceUnit,
  onDistanceUnitChange,
  setDistanceUnit,
} from "../../lib/distance-unit.js";

class DistanceUnitPickerElement extends HTMLElement {
  connectedCallback() {
    this.show(chosenDistanceUnit());
    // Chosen on another device, from the account.
    onDistanceUnitChange((unit) => this.show(unit));
    this.addEventListener("change", (event) => setDistanceUnit(event.target.value || null));
  }

  show(unit) {
    const input = this.querySelector(`input[value="${unit ?? ""}"]`);
    if (input) {
      input.checked = true;
    }
  }
}

customElements.define("ev-distance-unit-picker", DistanceUnitPickerElement);

export { DistanceUnitPickerElement };
