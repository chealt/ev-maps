// The signed-in user's favorite chargers, from the Worker (/api/favorites;
// the service worker answers from IndexedDB first where it runs). Kept in
// memory; "favorites-change" on document says they changed. Signed out,
// there are none.
import { isSignedIn, onSessionChange } from "./session.js";

const FAVORITES_URL = "/api/favorites";
const FAVORITES_CHANGE = "favorites-change";

// Charger ID → { charger, addedAt }
let favorites = new Map();

const notify = () => document.dispatchEvent(new CustomEvent(FAVORITES_CHANGE));

const favoriteUrl = (id) => `${FAVORITES_URL}/${encodeURIComponent(id)}`;

const loadFavorites = async () => {
  if (!isSignedIn()) {
    favorites = new Map();
    notify();
    return;
  }
  try {
    const response = await fetch(FAVORITES_URL);
    if (!response.ok) {
      return;
    }
    const { favorites: list } = await response.json();
    favorites = new Map(list.map((favorite) => [favorite.charger.id, favorite]));
    notify();
  } catch (error) {
    console.error("Could not load the favorites:", error);
  }
};

const isFavorite = (id) => favorites.has(id);

// Newest first.
const listFavorites = () => [...favorites.values()].sort((a, b) => b.addedAt - a.addedAt);

// Changes the favorites right away and saves the change; if saving fails,
// the change is undone and false returned.
const change = async (apply, undo, request) => {
  apply();
  notify();
  try {
    const response = await request();
    if (response.ok) {
      return true;
    }
  } catch (error) {
    console.error("Could not save the favorite:", error);
  }
  undo();
  notify();
  return false;
};

const addFavorite = (charger) => {
  const favorite = { charger, addedAt: Date.now() };
  return change(
    () => favorites.set(charger.id, favorite),
    () => favorites.delete(charger.id),
    () =>
      fetch(favoriteUrl(charger.id), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(favorite),
      })
  );
};

const removeFavorite = (id) => {
  const favorite = favorites.get(id);
  if (!favorite) {
    return Promise.resolve(true);
  }
  return change(
    () => favorites.delete(id),
    () => favorites.set(id, favorite),
    () => fetch(favoriteUrl(id), { method: "DELETE" })
  );
};

const onFavoritesChange = (listener) => document.addEventListener(FAVORITES_CHANGE, listener);

// Opens the favorites list (<ev-favorites-dialog>).
const requestFavorites = () => document.dispatchEvent(new CustomEvent("show-favorites"));

onSessionChange(() => loadFavorites());
if (isSignedIn()) {
  loadFavorites();
}

export {
  addFavorite,
  isFavorite,
  listFavorites,
  onFavoritesChange,
  removeFavorite,
  requestFavorites,
};
