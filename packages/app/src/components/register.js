/**
 * Client-side registration of Web Components
 * This file is loaded only in the browser
 */

import { MapApp } from "./app.js";

// Register the custom element only in the browser
if (
  typeof window !== "undefined" &&
  typeof customElements !== "undefined" &&
  typeof HTMLElement !== "undefined"
) {
  customElements.define("map-app", MapApp);
}
