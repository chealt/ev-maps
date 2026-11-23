# The map

## Chargers

When the map stops moving, `google-map/chargers.js` loads the
visible area's tiles from `/api/chargers/{z}/{x}/{y}`, which reads D1 through
the R*Tree index and merges each charger's records from different sources
(within 60 m) into one: every field comes from the best source that has it
(official registers such as EIPA and IRVE first, then Open Charge Map, then
OpenStreetMap), and the charger lists all of its sources, which the page
credits. Access, status and connector types are sent as IDs, which the page
translates. A full tile is split into smaller tiles. Tiles are cached at the
edge for a day and in the browser by the service worker.

## Clustering

`supercluster` groups nearby chargers; only the clusters and
chargers in view are drawn as markers. The filtering and the cluster index
run in a Web Worker (`charger-worker.js`, around `charger-index.js`), so
building and querying the index makes no long task on the main thread: the
page sends it the loaded chargers once, then the filters and the map's
bounds, and gets back charger IDs and clusters, which it maps to its own
chargers and draws (markers need the DOM). Where a module worker can't
start, `charger-index-client.js` answers the same calls in the page.

## Keyboard

Google Maps makes its clickable pins one tab stop, with the arrow keys
between them. Here Tab and Shift+Tab move between the pins (chargers and
clusters) in reading order, north to south, then west to east, and on to
the rest of the page past either end; Enter opens a charger's details or
zooms into a cluster. The map keeps each pin's position for this
(`markerPositions`), as the test fake's markers don't have one.
