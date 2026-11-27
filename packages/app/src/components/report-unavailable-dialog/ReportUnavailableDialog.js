import { chargerName } from "../../lib/charger-name.js";
import { message } from "../../lib/messages.js";
import { animateEscape, closeDialog, openDialog } from "../../lib/motion.js";

const SHOW_REPORT_UNAVAILABLE = "show-report-unavailable";
const FLAGS_URL = "/api/charger-unavailability";

// Opens the dialog for a charger ({ id, name, ... } as the map has it).
const requestReportUnavailable = (charger) =>
  document.dispatchEvent(new CustomEvent(SHOW_REPORT_UNAVAILABLE, { detail: { charger } }));

class ReportUnavailableDialogElement extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector("dialog");
    this.form = this.querySelector("form");
    this.photo = this.querySelector(".unavailable-photo");
    this.statusEl = this.querySelector(".status");
    this.errorEl = this.querySelector(".error");
    this.submitButton = this.querySelector('[type="submit"]');

    document.addEventListener(SHOW_REPORT_UNAVAILABLE, ({ detail }) => this.open(detail.charger));
    this.querySelector(".close").addEventListener("click", () => closeDialog(this.dialog));
    // Esc cancels choosing a photo; it must not close the dialog too.
    this.dialog.addEventListener("cancel", (event) => {
      if (this.photo.choosing) {
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
    this.photo.reset();
    this.statusEl.textContent = "";
    this.errorEl.textContent = "";
    this.submitButton.disabled = false;
    openDialog(this.dialog);
  }

  async submit() {
    this.statusEl.textContent = "";
    this.errorEl.textContent = "";
    this.submitButton.disabled = true;
    try {
      const response = await fetch(FLAGS_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chargerId: this.charger.id, photo: this.photo.photos[0] ?? null }),
      });
      if (!response.ok) {
        throw new Error(`Flag request failed: ${response.status}`);
      }
      this.statusEl.textContent = message("reportUnavailableSubmitted");
    } catch {
      this.submitButton.disabled = false;
      this.errorEl.textContent = message("reportUnavailableFailed");
    }
  }
}

customElements.define("ev-report-unavailable-dialog", ReportUnavailableDialogElement);

export { ReportUnavailableDialogElement, requestReportUnavailable };
