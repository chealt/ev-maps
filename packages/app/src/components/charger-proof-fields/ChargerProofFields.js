import { formatNumber, message } from "../../lib/messages.js";

const GEOLOCATION_OPTIONS = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 };

class ChargerProofFieldsElement extends HTMLElement {
  connectedCallback() {
    this.availability = this.querySelector(".availability");
    this.priceKind = this.querySelector(".price-kind");
    this.amountRow = this.querySelector(".price-amount");
    this.amount = this.querySelector(".amount");
    this.currency = this.querySelector(".currency");
    this.receipts = this.querySelector(".receipt-photos");
    this.locationStatus = this.querySelector(".location-status");
    this.priceKind.addEventListener("change", () => this.showPrice());
    this.querySelector(".share-location").addEventListener("click", () => this.shareLocation());
    this.showPrice();
  }

  // Whether a file picker of theirs has the focus.
  get choosingPhotos() {
    return this.receipts.choosing;
  }

  reset() {
    this.availability.value = "";
    this.priceKind.value = "";
    this.amount.value = "";
    this.receipts.reset();
    this.deviceLocation = null;
    this.locationStatus.textContent = "";
    this.showPrice();
  }

  // An amount for a paid price, and the receipt's photo for any price.
  showPrice() {
    const kind = this.priceKind.value;
    this.amountRow.hidden = !kind || kind === "free";
    this.receipts.hidden = !kind;
  }

  // Where the device is, from its GPS; how sure it is goes along.
  shareLocation() {
    if (!navigator.geolocation) {
      this.locationStatus.textContent = message("reportLocationUnavailable");
      return;
    }
    this.locationStatus.textContent = message("reportLocating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.deviceLocation = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : undefined,
        };
        this.locationStatus.textContent = Number.isFinite(coords.accuracy)
          ? message("reportLocationShared", { accuracy: formatNumber(Math.round(coords.accuracy)) })
          : message("reportLocationSharedNoAccuracy");
        this.dispatchEvent(new CustomEvent("location-shared", { bubbles: true }));
      },
      () => {
        this.locationStatus.textContent = message("reportLocationUnavailable");
      },
      GEOLOCATION_OPTIONS
    );
  }

  // What the user said, for the API, or the message saying what's missing.
  read({ needsChange, needsLocation }) {
    const availability = this.availability.value || undefined;
    const kind = this.priceKind.value;
    const amount = Number.parseFloat(this.amount.value);
    let price;
    if (kind === "free") {
      price = { free: true };
    } else if (kind) {
      if (!Number.isFinite(amount) || amount <= 0) {
        return { error: "reportPriceNeeded" };
      }
      price = { amount, currency: this.currency.value, unit: kind };
    }
    if (needsChange && !availability && !price) {
      return { error: "reportChangeNeeded" };
    }
    if (price && this.receipts.photos.length === 0) {
      return { error: "reportReceiptNeeded" };
    }
    if (needsLocation && !this.deviceLocation) {
      return { error: "reportLocationNeeded" };
    }
    return {
      value: {
        availability,
        price,
        deviceLocation: this.deviceLocation ?? undefined,
        receiptPhotos: price ? this.receipts.photos : undefined,
      },
    };
  }
}

customElements.define("ev-charger-proof-fields", ChargerProofFieldsElement);

export { ChargerProofFieldsElement };
