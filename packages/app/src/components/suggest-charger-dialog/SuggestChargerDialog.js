import { getMapCenter } from "../../lib/map-center.js";
import { formatNumber, message } from "../../lib/messages.js";
import { animateEscape, closeDialog, openDialog } from "../../lib/motion.js";

const SHOW_SUGGEST_CHARGER = "show-suggest-charger";
// Asks the map to let the user drop a pin ({ near }: where to start), and
// its answer ({ location }, null when cancelled).
const PICK_MAP_LOCATION = "pick-map-location";
const MAP_LOCATION_PICKED = "map-location-picked";
const SUGGESTIONS_URL = "/api/charger-suggestions";
const MAX_CONNECTORS = 20;
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });

const requestSuggestCharger = () => document.dispatchEvent(new CustomEvent(SHOW_SUGGEST_CHARGER));

class SuggestChargerDialogElement extends HTMLElement {
  photosDataUrls = [];

  connectedCallback() {
    this.dialog = this.querySelector("dialog");
    this.form = this.querySelector("form");
    this.addressInput = this.querySelector("#suggest-charger-address")?.closest("ev-place-input");
    this.operatorSelect = this.querySelector(".charger-operator-select");
    this.operatorCustom = this.querySelector(".charger-operator-custom");
    this.connectorList = this.querySelector(".connector-list");
    this.photoInput = this.querySelector(".charger-photo");
    this.photoGrid = this.querySelector(".photo-grid");
    this.statusEl = this.querySelector(".status");
    this.errorEl = this.querySelector(".error");
    this.proof = this.querySelector("ev-charger-proof-fields");
    this.addEventListener("photo-limit", () => {
      this.errorEl.textContent = message("reportPhotoLimit");
    });
    this.addEventListener("photo-unreadable", () => {
      this.errorEl.textContent = message("reportPhotoUnreadable");
    });

    document.addEventListener(SHOW_SUGGEST_CHARGER, () => this.open());
    this.querySelector(".close").addEventListener("click", () => closeDialog(this.dialog));
    // Esc cancels choosing photos (the focus is on the dropzone's file input,
    // e.g. right after its picker closes); it must not close the dialog too.
    this.dialog.addEventListener("cancel", (event) => {
      if (this.photoInput.matches(":focus") || this.proof.choosingPhotos) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    });
    animateEscape(this.dialog);
    this.querySelector(".add-connector").addEventListener("click", () => this.addConnectorRow());
    this.operatorSelect.addEventListener("change", () => this.handleOperatorChange());
    this.photoInput.addEventListener("change", () => this.handlePhotoChange());
    this.pinned = this.querySelector(".pinned");
    this.querySelector(".drop-pin").addEventListener("click", () => this.dropPin());
    this.querySelector(".remove-pin").addEventListener("click", () => this.setPin(null));
    document.addEventListener(MAP_LOCATION_PICKED, ({ detail }) => this.pinPicked(detail));
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submit();
    });
  }

  handleOperatorChange() {
    const isOther = this.operatorSelect.value === "__other__";
    this.operatorCustom.hidden = !isOther;
    if (isOther) {
      this.operatorCustom.focus();
    }
  }

  // The dialog steps aside, keeping what's filled in, while the user moves
  // the map under a pin; it starts at the address's spot when there's one.
  async dropPin() {
    let near = null;
    try {
      near = (await this.addressLocation())?.location ?? null;
    } catch {
      // The address's place couldn't be loaded: start where the map is.
    }
    this.picking = true;
    await closeDialog(this.dialog);
    document.dispatchEvent(new CustomEvent(PICK_MAP_LOCATION, { detail: { near } }));
  }

  // Back in the dialog, once it's open, with the focus on the button: the
  // form from its top, scrolled only as far as the button needs to be seen,
  // the same every time (wherever a focus had scrolled it before).
  async pinPicked(detail) {
    if (!this.picking) {
      return;
    }
    this.picking = false;
    if (detail?.location) {
      this.setPin(detail.location);
    }
    await openDialog(this.dialog);
    const button = this.querySelector(".drop-pin");
    this.form.scrollTop = 0;
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: "nearest" });
  }

  setPin(location) {
    this.pinnedLocation = location;
    this.pinned.hidden = !location;
    if (location) {
      const coordinate = (value) => formatNumber(value, { maximumFractionDigits: 5 });
      this.querySelector(".pinned-text").textContent = message("pinnedAt", {
        lat: coordinate(location.lat),
        lng: coordinate(location.lng),
      });
    }
  }

  open() {
    this.form.reset();
    this.setPin(null);
    this.operatorCustom.hidden = true;
    this.photosDataUrls = [];
    this.renderPhotos();
    this.proof.reset();
    this.statusEl.textContent = "";
    this.errorEl.textContent = "";

    const center = getMapCenter();
    if (center) {
      this.centerLocation = center;
    }
    this.connectorList.replaceChildren();
    this.addConnectorRow();
    openDialog(this.dialog);
  }

  addConnectorRow() {
    if (this.connectorList.children.length >= MAX_CONNECTORS) {
      return;
    }
    const template = this.querySelector(".connector-row-template");
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector(".remove-connector").addEventListener("click", () => {
      if (this.connectorList.children.length > 1) {
        row.remove();
        this.updateConnectorRows();
      }
    });
    this.connectorList.append(row);
    this.updateConnectorRows();
  }

  updateConnectorRows() {
    const rows = [...this.connectorList.children];
    for (const [index, row] of rows.entries()) {
      row.setAttribute("aria-label", message("chargerUnitNumber", { number: index + 1 }));
      row.querySelector(".remove-connector").disabled = rows.length <= 1;
    }
  }

  async handlePhotoChange() {
    this.errorEl.textContent = "";
    const files = [...(this.photoInput.files ?? [])];
    if (!files.length) {
      return;
    }
    for (const file of files) {
      if (this.photosDataUrls.length >= MAX_PHOTOS) {
        this.errorEl.textContent = message("suggestChargerPhotoLimit");
        break;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        this.errorEl.textContent = message("suggestChargerPhotoTooLarge");
        continue;
      }
      try {
        const dataUrl = await readAsDataUrl(file);
        this.photosDataUrls.push(dataUrl);
      } catch {
        this.errorEl.textContent = message("suggestChargerInvalid");
      }
    }
    this.photoInput.value = "";
    this.renderPhotos();
  }

  renderPhotos() {
    this.photoGrid.hidden = this.photosDataUrls.length === 0;
    const template = this.querySelector(".photo-item-template");
    this.photoGrid.replaceChildren(
      ...this.photosDataUrls.map((url, index) => {
        const item = template.content.firstElementChild.cloneNode(true);
        item.querySelector(".photo-thumb").src = url;
        item.querySelector(".remove-photo").addEventListener("click", () => {
          this.photosDataUrls.splice(index, 1);
          this.renderPhotos();
        });
        return item;
      })
    );
  }

  // The charger's address, and its location: the pin dropped on the map, if
  // any, else the address's.
  async resolveLocation() {
    const resolved = await this.addressLocation();
    if (this.pinnedLocation) {
      return {
        address:
          resolved?.address ??
          this.addressInput?.querySelector(".field-control")?.value.trim() ??
          "",
        location: this.pinnedLocation,
      };
    }
    return resolved;
  }

  async addressLocation() {
    const placeObj = this.addressInput?.place;
    if (placeObj?.place) {
      await placeObj.place.fetchFields({ fields: ["location", "displayName", "formattedAddress"] });
      const loc = placeObj.place.location;
      const location = typeof loc?.toJSON === "function" ? loc.toJSON() : loc;
      return {
        address: placeObj.label || placeObj.place.formattedAddress || "",
        location,
      };
    }
    if (placeObj?.location) {
      return { address: placeObj.label || "", location: placeObj.location };
    }
    const address = this.addressInput?.querySelector(".field-control")?.value.trim() || "";
    if (this.centerLocation) {
      return { address, location: this.centerLocation };
    }
    return null;
  }

  async submit() {
    this.statusEl.textContent = "";
    this.errorEl.textContent = "";
    const name = this.querySelector(".charger-name").value.trim();
    const opSelectVal = this.operatorSelect.value;
    const operator = (opSelectVal === "__other__" ? this.operatorCustom.value : opSelectVal).trim();

    const resolved = await this.resolveLocation();
    if (!resolved) {
      this.errorEl.textContent = message("suggestChargerInvalid");
      return;
    }
    const { address, location } = resolved;

    const connectors = [...this.connectorList.children].map((row) => ({
      type: row.querySelector(".connector-type").value,
      powerKw: Number.parseFloat(row.querySelector(".connector-power").value),
      quantity: Number.parseInt(row.querySelector(".connector-quantity").value, 10),
    }));

    if (
      !name ||
      !location ||
      !Number.isFinite(location.lat) ||
      !Number.isFinite(location.lng) ||
      Math.abs(location.lat) > 90 ||
      Math.abs(location.lng) > 180 ||
      !connectors.length ||
      connectors.some(
        (item) =>
          !Number.isFinite(item.powerKw) ||
          item.powerKw <= 0 ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1
      ) ||
      !this.photosDataUrls.length
    ) {
      this.errorEl.textContent = message("suggestChargerInvalid");
      return;
    }

    const proof = this.proof.read({ needsChange: false, needsLocation: false });
    if (proof.error) {
      this.errorEl.textContent = message(proof.error);
      return;
    }

    try {
      const response = await fetch(SUGGESTIONS_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          address: address || undefined,
          operator: operator || undefined,
          location,
          connectors,
          photo: this.photosDataUrls[0],
          photos: this.photosDataUrls,
          ...proof.value,
        }),
      });
      if (!response.ok) {
        throw new Error(`Suggestion request failed: ${response.status}`);
      }
      this.statusEl.textContent = message("suggestChargerSubmitted");
    } catch {
      this.errorEl.textContent = message("suggestChargerFailed");
    }
  }
}

customElements.define("ev-suggest-charger-dialog", SuggestChargerDialogElement);

export { SuggestChargerDialogElement, requestSuggestCharger };
