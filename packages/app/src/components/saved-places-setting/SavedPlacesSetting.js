import { isSignedIn, onSessionChange } from "../../lib/session.js";
import {
  onSavedPlacesOnMapChange,
  savedPlacesOnMap,
  setSavedPlacesOnMap,
} from "../../lib/saved-places-on-map.js";

class SavedPlacesSettingElement extends HTMLElement {
  connectedCallback() {
    this.checkbox = this.querySelector(".saved-places-on-map");
    this.checkbox.addEventListener("change", () => setSavedPlacesOnMap(this.checkbox.checked));
    this.show();
    onSavedPlacesOnMapChange(() => this.show());
    onSessionChange(() => this.show());
  }

  show() {
    this.hidden = !isSignedIn();
    this.checkbox.checked = savedPlacesOnMap();
  }
}

customElements.define("ev-saved-places-setting", SavedPlacesSettingElement);

export { SavedPlacesSettingElement };
