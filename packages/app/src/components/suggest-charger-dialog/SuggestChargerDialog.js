import { getMapCenter } from "../../lib/map-center.js";
import { message } from "../../lib/messages.js";
import { animateEscape, closeDialog, openDialog } from "../../lib/motion.js";

const SHOW_SUGGEST_CHARGER = "show-suggest-charger";
const SUGGESTIONS_URL = "/api/charger-suggestions";
const MAX_CONNECTORS = 20;

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });

const requestSuggestCharger = () => document.dispatchEvent(new CustomEvent(SHOW_SUGGEST_CHARGER));

class SuggestChargerDialogElement extends HTMLElement {
  photoDataUrl = null;

  connectedCallback() {
    this.dialog = this.querySelector("dialog");
    this.form = this.querySelector("form");
    this.connectorList = this.querySelector(".connector-list");
    this.photoInput = this.querySelector(".charger-photo");
    this.photoPreview = this.querySelector(".photo-preview");
    this.statusEl = this.querySelector(".status");
    this.errorEl = this.querySelector(".error");

    document.addEventListener(SHOW_SUGGEST_CHARGER, () => this.open());
    this.querySelector(".close").addEventListener("click", () => closeDialog(this.dialog));
    animateEscape(this.dialog);
    this.querySelector(".add-connector").addEventListener("click", () => this.addConnectorRow());
    this.photoInput.addEventListener("change", () => this.handlePhotoChange());
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submit();
    });
  }

  open() {
    this.form.reset();
    this.photoDataUrl = null;
    this.photoPreview.hidden = true;
    this.photoPreview.removeAttribute("src");
    this.statusEl.textContent = "";
    this.errorEl.textContent = "";
    const center = getMapCenter();
    if (center) {
      this.querySelector(".charger-lat").value = center.lat.toFixed(5);
      this.querySelector(".charger-lng").value = center.lng.toFixed(5);
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
    const [file] = this.photoInput.files ?? [];
    if (!file) {
      this.photoDataUrl = null;
      this.photoPreview.hidden = true;
      return;
    }
    try {
      this.photoDataUrl = await readAsDataUrl(file);
      this.photoPreview.src = this.photoDataUrl;
      this.photoPreview.hidden = false;
    } catch {
      this.photoDataUrl = null;
      this.photoPreview.hidden = true;
      this.errorEl.textContent = message("suggestChargerInvalid");
    }
  }

  async submit() {
    this.statusEl.textContent = "";
    this.errorEl.textContent = "";
    const name = this.querySelector(".charger-name").value.trim();
    const address = this.querySelector(".charger-address").value.trim();
    const operator = this.querySelector(".charger-operator").value.trim();
    const lat = Number.parseFloat(this.querySelector(".charger-lat").value);
    const lng = Number.parseFloat(this.querySelector(".charger-lng").value);
    const connectors = [...this.connectorList.children].map((row) => ({
      type: row.querySelector(".connector-type").value,
      powerKw: Number.parseFloat(row.querySelector(".connector-power").value),
      quantity: Number.parseInt(row.querySelector(".connector-quantity").value, 10),
    }));

    if (
      !name ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180 ||
      !connectors.length ||
      connectors.some(
        (item) =>
          !Number.isFinite(item.powerKw) ||
          item.powerKw <= 0 ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1
      ) ||
      !this.photoDataUrl
    ) {
      this.errorEl.textContent = message("suggestChargerInvalid");
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
          location: { lat, lng },
          connectors,
          photo: this.photoDataUrl,
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
