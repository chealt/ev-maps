import { fetchAccountSettings } from "../../lib/account-settings.js";
import { message } from "../../lib/messages.js";
import {
  readSavedPlaces,
  removeSavedPlace,
  updateSavedPlace,
} from "../google-map/route-history.js";

class SavedPlacesPageElement extends HTMLElement {
  connectedCallback() {
    this.summary = this.querySelector(".summary");
    this.list = this.querySelector(".place-list");
    this.load();
  }

  // The page has no account menu: signed out, the account has no settings.
  async load() {
    if (!(await fetchAccountSettings())) {
      this.summary.textContent = message("signInForMySavedPlaces");
      return;
    }
    this.show(await readSavedPlaces());
  }

  show(places, said) {
    this.summary.textContent =
      said ??
      (places.length === 0
        ? message("noMySavedPlaces")
        : message("mySavedPlaceCount", { count: places.length }));
    this.list.replaceChildren(...places.map((place) => this.card(place)));
  }

  card(place) {
    const card = this.querySelector(".place-template").content.firstElementChild.cloneNode(true);
    const id = `saved-place-${this.list.childElementCount}-${Math.random().toString(36).slice(2)}`;
    const name = card.querySelector(".place-name");
    name.id = id;
    name.textContent = place.name;
    card.setAttribute("aria-labelledby", id);
    const iconLabel = card.querySelector(".icons .label");
    iconLabel.id = `${id}-icon`;
    card.querySelector(".icons").setAttribute("aria-labelledby", iconLabel.id);
    card.querySelector(`.place-icon [data-icon="${place.icon}"]`)?.removeAttribute("hidden");
    card.querySelector(".place-label").textContent = place.label;

    const form = card.querySelector(".place-form");
    form.elements.name.value = place.name;
    let icon = place.icon;
    const pressIcon = () => {
      for (const option of card.querySelectorAll(".icon-option")) {
        option.setAttribute("aria-pressed", String(option.dataset.iconValue === icon));
      }
    };
    pressIcon();
    card.querySelector(".icon-options").addEventListener("click", (event) => {
      const option = event.target.closest(".icon-option");
      if (option) {
        icon = option.dataset.iconValue;
        pressIcon();
      }
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const newName = form.elements.name.value.trim();
      if (!newName) {
        return;
      }
      const places = await updateSavedPlace(place, { name: newName, icon });
      this.show(places, message("savedPlaceChangesSaved", { name: newName }));
    });
    card.querySelector(".remove").addEventListener("click", async () => {
      const places = await removeSavedPlace(place);
      this.show(places, message("savedPlaceRemoved", { name: place.name }));
    });
    return card;
  }
}

customElements.define("ev-saved-places-page", SavedPlacesPageElement);

export { SavedPlacesPageElement };
