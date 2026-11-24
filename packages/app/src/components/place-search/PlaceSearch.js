// A place search: a field with Google's suggestions (the same PlaceInput the
// route planner uses). Choosing a place shows it on the map (place-chosen)
// or sets it as the route's destination (place-navigate).
import { animateEscape, closeDialog, openDialog } from "../../lib/motion.js";

class PlaceSearchElement extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector("dialog");
    this.input = this.querySelector("ev-place-input");
    this.hereButton = this.querySelector(".search-here");
    this.navigateButton = this.querySelector(".plan-route-here");

    this.querySelector(".search-place-button").addEventListener("click", () => this.open());
    this.querySelector(".close").addEventListener("click", () => closeDialog(this.dialog));
    animateEscape(this.dialog);
    this.hereButton.addEventListener("click", () => this.showPlace());
    this.navigateButton.addEventListener("click", () => this.navigateHere());
    this.input.addEventListener("place-changed", () => {
      const hasPlace = !this.input.place?.place;
      this.hereButton.disabled = hasPlace;
      this.navigateButton.disabled = hasPlace;
    });
  }

  open() {
    openDialog(this.dialog);
    this.input.querySelector(".field").focus();
  }

  // Google's PlaceInput sets `place` once a suggestion is chosen; its
  // location needs fetching (one call).
  async resolvePlace() {
    const { place } = this.input;
    if (!place?.place) {
      return null;
    }
    await place.place.fetchFields({ fields: ["location", "displayName"] });
    const loc = place.place.location;
    const location = typeof loc?.toJSON === "function" ? loc.toJSON() : loc;
    const label = place.label || place.place.displayName?.toString() || "";
    return { label, location, place: place.place };
  }

  async showPlace() {
    const resolved = await this.resolvePlace();
    if (!resolved) {
      return;
    }
    this.dialog.close();
    this.emit("place-chosen", resolved);
  }

  async navigateHere() {
    const resolved = await this.resolvePlace();
    if (!resolved) {
      return;
    }
    this.dialog.close();
    this.emit("place-navigate", resolved);
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

customElements.define("ev-place-search", PlaceSearchElement);

export { PlaceSearchElement };
