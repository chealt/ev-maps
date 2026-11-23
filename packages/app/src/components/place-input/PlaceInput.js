// A place field with Google's place suggestions (Places API, New) in a
// combobox the page renders. `place` is the chosen place: a Google Place, or a
// location set with setPlace(), e.g. the user's.
import { loadGoogleMaps } from "../google-map/loader.js";

const SUGGEST_DELAY_MS = 250;

class PlaceInputElement extends HTMLElement {
  place = null;
  suggestions = [];
  activeIndex = -1;

  connectedCallback() {
    this.input = this.querySelector(".field");
    this.list = this.querySelector(".options");
    this.template = this.querySelector(".option-template");

    this.input.addEventListener("input", () => this.handleInput());
    this.input.addEventListener("keydown", (event) => this.handleKeydown(event));
    this.input.addEventListener("blur", () => this.closeOptions());
    // Choosing on mousedown keeps the focus in the field.
    this.list.addEventListener("mousedown", (event) => {
      const option = event.target.closest(".option");
      if (option) {
        event.preventDefault();
        this.choose(Number(option.dataset.index));
      }
    });
  }

  // The Places library, loaded with the map's key the first time it's needed.
  placesLibrary() {
    const apiKey = this.closest("[data-api-key]")?.dataset.apiKey;
    this.places ??= loadGoogleMaps(apiKey).then((maps) => maps.importLibrary("places"));
    return this.places;
  }

  handleInput() {
    this.place = null;
    clearTimeout(this.suggestTimer);
    const text = this.input.value.trim();
    if (!text) {
      this.closeOptions();
      return;
    }
    this.suggestTimer = setTimeout(() => this.suggest(text), SUGGEST_DELAY_MS);
  }

  async suggest(text) {
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await this.placesLibrary();
      // One session from typing to choosing, as Google bills suggestions.
      this.sessionToken ??= new AutocompleteSessionToken();
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: text,
        sessionToken: this.sessionToken,
        language: document.documentElement.lang,
      });
      // Typing went on while this was loading.
      if (this.input.value.trim() !== text) {
        return;
      }
      this.showOptions(suggestions.filter((suggestion) => suggestion.placePrediction));
    } catch (error) {
      console.error("Could not load place suggestions:", error);
      this.closeOptions();
    }
  }

  showOptions(suggestions) {
    this.suggestions = suggestions;
    this.activeIndex = -1;
    this.list.replaceChildren(
      ...suggestions.map(({ placePrediction }, index) => {
        const option = this.template.content.firstElementChild.cloneNode(true);
        option.id = `${this.list.id}-${index}`;
        option.dataset.index = String(index);
        option.setAttribute("aria-label", placePrediction.text.toString());
        option.querySelector(".main").textContent = placePrediction.mainText?.toString() ?? "";
        option.querySelector(".secondary").textContent =
          placePrediction.secondaryText?.toString() ?? "";
        return option;
      })
    );
    const open = suggestions.length > 0;
    this.list.hidden = !open;
    this.input.setAttribute("aria-expanded", String(open));
    this.input.removeAttribute("aria-activedescendant");
  }

  closeOptions() {
    this.list.hidden = true;
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
    this.activeIndex = -1;
  }

  handleKeydown(event) {
    if (this.list.hidden) {
      return;
    }
    const count = this.suggestions.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      this.setActive((this.activeIndex + step + count) % count);
    } else if (event.key === "Enter" && this.activeIndex >= 0) {
      event.preventDefault();
      this.choose(this.activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.closeOptions();
    }
  }

  setActive(index) {
    this.activeIndex = index;
    for (const option of this.list.children) {
      option.setAttribute("aria-selected", String(Number(option.dataset.index) === index));
    }
    this.input.setAttribute("aria-activedescendant", `${this.list.id}-${index}`);
  }

  choose(index) {
    const { placePrediction } = this.suggestions[index];
    this.input.value = placePrediction.text.toString();
    this.place = { label: this.input.value, place: placePrediction.toPlace() };
    this.sessionToken = null;
    this.closeOptions();
  }

  // A place chosen elsewhere: a location (e.g. "My location"), or a Google
  // place (e.g. a route restored after a reload).
  setPlace({ label, location, place }) {
    this.input.value = label;
    this.place = place ? { label, place } : { label, location };
    this.closeOptions();
  }
}

customElements.define("ev-place-input", PlaceInputElement);

export { PlaceInputElement };
