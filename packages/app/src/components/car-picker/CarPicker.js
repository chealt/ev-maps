import { chosenCar, onCarChange, setCar } from "../../lib/car.js";

class CarPickerElement extends HTMLElement {
  connectedCallback() {
    this.show(chosenCar());
    // Chosen on another device, from the account.
    onCarChange((car) => this.show(car));
    this.addEventListener("change", () => this.save());
  }

  show({ connectors, autoFilter }) {
    for (const input of this.querySelectorAll('input[name="car-connector"]')) {
      input.checked = connectors.includes(input.value);
    }
    this.querySelector('input[name="car-auto-filter"]').checked = autoFilter;
  }

  save() {
    setCar({
      connectors: [...this.querySelectorAll('input[name="car-connector"]:checked')].map(
        (input) => input.value
      ),
      autoFilter: this.querySelector('input[name="car-auto-filter"]').checked,
    });
  }
}

customElements.define("ev-car-picker", CarPickerElement);

export { CarPickerElement };
