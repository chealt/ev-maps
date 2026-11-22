# Favorites

Signed in, the heart in a charger's details saves it to the
Worker's `/api/favorites` (`packages/worker/src/favorites.js`, D1 table
`favorites`, with a copy of the charger so the list needs no tiles), and
`src/lib/favorites.js` keeps them in memory. The account menu's Favorites
opens `<ev-favorites-dialog>`, which morphs out of the account box (a view
transition) and lists them nearest to the map's center first; picking one
shows it on the map. The Filters dialog's "Only favorites" hides the rest.
Signed out, the heart, the menu item and the filter are disabled and ask to
sign in. Where the service worker runs (`public/sw.js`), it sits in front of
`/api/favorites`: changes go to IndexedDB and an outbox first and are
answered at once, then sent to the Worker (right away, on Background Sync,
and before the list is read); the list comes from the network, or from
IndexedDB offline, with the unsent changes on top. Signing out clears both.
