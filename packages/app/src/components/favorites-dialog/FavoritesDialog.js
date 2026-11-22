import { chargerName } from "../../lib/charger-name.js";
import { distanceInMeters, formatDistance } from "../../lib/distance.js";
import { listFavorites, onFavoritesChange, removeFavorite } from "../../lib/favorites.js";
import { message } from "../../lib/messages.js";
import { getMapCenter } from "../../lib/map-center.js";

const SHOW_FAVORITES = "show-favorites";
const SHOW_CHARGER = "show-charger";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Runs a DOM update as a view transition where supported and wanted.
const withViewTransition = (update) => {
  if (!document.startViewTransition || prefersReducedMotion()) {
    update();
    return Promise.resolve();
  }
  return document.startViewTransition(update).finished.catch(() => {});
};

// Where the account box is, to morph from and back to.
const accountBox = () => document.querySelector(".user-menu .bar");

class FavoritesDialogElement extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector("dialog");
    this.items = this.querySelector(".items");
    document.addEventListener(SHOW_FAVORITES, () => this.open());
    this.querySelector(".close").addEventListener("click", () => this.close());
    // Escape closes the dialog without a transition, so close it with one.
    this.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.close();
    });
    this.items.addEventListener("click", (event) => this.handleClick(event));
    onFavoritesChange(() => {
      if (this.dialog.open) {
        this.render();
      }
    });
  }

  async open() {
    if (this.dialog.open) {
      return;
    }
    await this.render();
    const box = accountBox();
    box?.classList.add("favorites-transition");
    withViewTransition(() => {
      box?.classList.remove("favorites-transition");
      this.dialog.classList.add("favorites-transition");
      this.dialog.showModal();
    }).finally(() => this.dialog.classList.remove("favorites-transition"));
  }

  close() {
    if (!this.dialog.open) {
      return Promise.resolve();
    }
    const box = accountBox();
    this.dialog.classList.add("favorites-transition");
    return withViewTransition(() => {
      this.dialog.classList.remove("favorites-transition");
      this.dialog.close();
      box?.classList.add("favorites-transition");
    }).finally(() => box?.classList.remove("favorites-transition"));
  }

  // The favorites, nearest to the map's center first (newest first until
  // the map has loaded).
  async render() {
    const center = getMapCenter();
    const favorites = listFavorites().map(({ charger }) => ({
      charger,
      meters: center ? distanceInMeters(center, charger.location) : null,
    }));
    if (center) {
      favorites.sort((a, b) => a.meters - b.meters);
    }
    this.shown = favorites.map(({ charger }) => charger);
    const template = this.querySelector(".item-template");
    this.items.replaceChildren(
      ...favorites.map(({ charger, meters }, index) => {
        const item = template.content.firstElementChild.cloneNode(true);
        item.dataset.index = String(index);
        item.querySelector(".name").textContent = chargerName(charger);
        item.querySelector(".distance").textContent = meters === null ? "" : formatDistance(meters);
        item.querySelector(".meta").textContent = [
          charger.maxPowerKw ? message("power", { power: charger.maxPowerKw }) : null,
          charger.address,
        ]
          .filter(Boolean)
          .join(" · ");
        item
          .querySelector(".remove")
          .setAttribute("aria-label", message("removeFavorite", { name: chargerName(charger) }));
        return item;
      })
    );
  }

  async handleClick(event) {
    const item = event.target.closest(".item");
    if (!item) {
      return;
    }
    const charger = this.shown[Number(item.dataset.index)];
    if (event.target.closest(".remove")) {
      const index = Number(item.dataset.index);
      await removeFavorite(charger.id);
      // The list re-renders: focus the favorite now in its place, or the
      // last one, or the close button when none is left.
      await this.render();
      const entries = this.items.querySelectorAll(".entry");
      (entries[Math.min(index, entries.length - 1)] ?? this.querySelector(".close")).focus();
      return;
    }
    if (event.target.closest(".entry")) {
      await this.close();
      document.dispatchEvent(new CustomEvent(SHOW_CHARGER, { detail: { charger } }));
    }
  }
}

customElements.define("ev-favorites-dialog", FavoritesDialogElement);

export { FavoritesDialogElement };
