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
chargers in view are drawn as markers.
