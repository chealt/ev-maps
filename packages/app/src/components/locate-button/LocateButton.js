import { message } from "../../lib/messages.js";

const GEOLOCATION_TIMEOUT_MS = 10000;

// GeolocationPositionError codes.
const ERROR_MESSAGES = {
  1: "locationDenied",
  2: "locationUnavailable",
  3: "locationTimeout",
};

class LocateButtonElement extends HTMLElement {
  connectedCallback() {
    this.querySelector("button")?.addEventListener("click", () => this.handleClick());
  }

  // Called by <ev-google-map> on load when there's no saved map view and
  // data-auto-locate is set; asks for the location only if already permitted.
  async locateIfPermitted() {
    const permission = await navigator.permissions
      ?.query({ name: "geolocation" })
      .catch(() => null);
    if (permission?.state === "granted") {
      this.handleClick();
    }
  }

  handleClick() {
    this.emit("locate-start");

    if (!navigator.geolocation) {
      this.emit("location-error", { message: message("locationUnsupported") });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => this.handleSuccess(position),
      (error) => this.handleError(error),
      { enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS }
    );
  }

  handleSuccess({ coords }) {
    this.emit("location-found", { lat: coords.latitude, lng: coords.longitude });
  }

  handleError(error) {
    this.emit("location-error", {
      code: error.code,
      message: message(ERROR_MESSAGES[error.code] ?? "locationFailed"),
    });
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

customElements.define("ev-locate-button", LocateButtonElement);

export { LocateButtonElement };
