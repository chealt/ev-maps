const GEOLOCATION_TIMEOUT_MS = 10000;

const ERROR_MESSAGES = {
  1: "Location permission denied",
  2: "Location unavailable",
  3: "Location request timed out",
};

class LocateButtonElement extends HTMLElement {
  connectedCallback() {
    this.querySelector("button")?.addEventListener("click", () => this.handleClick());

    if (this.hasAttribute("data-auto-locate")) {
      this.locateIfPermitted();
    }
  }

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
      this.handleError({ message: "Geolocation is not supported by this browser" });
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
      message: ERROR_MESSAGES[error.code] || error.message || "Unable to determine your location",
    });
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

customElements.define("ev-locate-button", LocateButtonElement);

export { LocateButtonElement };
