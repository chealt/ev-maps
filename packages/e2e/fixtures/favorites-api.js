// Fakes the Worker's favorites (/api/favorites): starts with `favorites`
// ([{ charger, addedAt }]), keeps what's saved and removed, and records the
// changes. A context route, so the service worker's requests are faked too.
const fakeFavoritesApi = async (page, favorites = [], { failChanges = false } = {}) => {
  const state = new Map(favorites.map((favorite) => [favorite.charger.id, favorite]));
  const changes = [];
  await page.context().route(/\/api\/favorites(\/[^/?]+)?$/, (route) => {
    const request = route.request();
    const id = decodeURIComponent(new URL(request.url()).pathname.split("/")[3] ?? "");
    if (request.method() === "GET") {
      const list = [...state.values()].sort((a, b) => b.addedAt - a.addedAt);
      return route.fulfill({ json: { favorites: list } });
    }
    changes.push({ method: request.method(), id, body: request.postDataJSON() });
    if (failChanges) {
      return route.fulfill({ status: 500, json: { error: "Failed" } });
    }
    if (request.method() === "PUT") {
      state.set(id, request.postDataJSON());
    } else {
      state.delete(id);
    }
    return route.fulfill({ json: {} });
  });
  return changes;
};

export { fakeFavoritesApi };
