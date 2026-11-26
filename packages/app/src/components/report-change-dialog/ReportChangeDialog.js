import { chargerName } from "../../lib/charger-name.js";
import { message } from "../../lib/messages.js";
import { animateEscape, closeDialog, openDialog } from "../../lib/motion.js";

const SHOW_REPORT_CHANGE = "show-report-change";
const REPORTS_URL = "/api/charger-reports";

// Opens the dialog for a charger ({ id, name, ... } as the map has it).
const requestReportChange = (charger) =>
  document.dispatchEvent(new CustomEvent(SHOW_REPORT_CHANGE, { detail: { charger } }));

class ReportChangeDialogElement extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector("dialog");
    this.form = this.querySelector("form");
    this.proof = this.querySelector("ev-charger-proof-fields");
    this.chargerPhotos = this.querySelector(".charger-photos");
    this.statusEl = this.querySelector(".status");
    this.errorEl = this.querySelector(".error");
    this.submitButton = this.querySelector('[type="submit"]');

    document.addEventListener(SHOW_REPORT_CHANGE, ({ detail }) => this.open(detail.charger));
    this.querySelector(".close").addEventListener("click", () => closeDialog(this.dialog));
    // Esc cancels choosing photos; it must not close the dialog too.
    this.dialog.addEventListener("cancel", (event) => {
      if (this.chargerPhotos.choosing || this.proof.choosingPhotos) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    });
    animateEscape(this.dialog);
    this.addEventListener("photo-limit", () => {
      this.errorEl.textContent = message("reportPhotoLimit");
    });
    this.addEventListener("photo-unreadable", () => {
      this.errorEl.textContent = message("reportPhotoUnreadable");
    });
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submit();
    });
  }

  open(charger) {
    this.charger = charger;
    this.querySelector(".charger-name").textContent = chargerName(charger);
    this.proof.reset();
    this.chargerPhotos.reset();
    this.statusEl.textContent = "";
    this.errorEl.textContent = "";
    this.submitButton.disabled = false;
    openDialog(this.dialog);
  }

  async submit() {
    this.statusEl.textContent = "";
    this.errorEl.textContent = "";
    const { error, value } = this.proof.read({ needsChange: true, needsLocation: true });
    if (error) {
      this.errorEl.textContent = message(error);
      return;
    }
    if (this.chargerPhotos.photos.length === 0) {
      this.errorEl.textContent = message("reportChargerPhotoNeeded");
      return;
    }
    this.submitButton.disabled = true;
    try {
      const response = await fetch(REPORTS_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chargerId: this.charger.id,
          ...value,
          chargerPhotos: this.chargerPhotos.photos,
        }),
      });
      if (!response.ok) {
        throw new Error(`Report request failed: ${response.status}`);
      }
      this.statusEl.textContent = message("reportChangeSubmitted");
    } catch {
      this.submitButton.disabled = false;
      this.errorEl.textContent = message("reportChangeFailed");
    }
  }
}

customElements.define("ev-report-change-dialog", ReportChangeDialogElement);

export { ReportChangeDialogElement, requestReportChange };
