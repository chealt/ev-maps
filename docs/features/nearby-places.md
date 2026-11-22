# Places next to chargers

The import's `amenities` jobs
(`packages/worker/src/import/amenities.js`) ask OpenStreetMap's Overpass API,
per 1°×1° cell with chargers, for cafés, toilets, restaurants (and fast
food) and playgrounds (centers only), and store a bit per kind within 150 m
in each charger's `amenities` column (`src/amenities.js`). The cells are
listed at most daily, as that reads every charger, and refreshed weekly like
the chargers. Tiles carry them as `amenities: ["coffee", ...]`; the details
list them with OpenStreetMap's credit, and signed in, the Filters dialog's
"Nearby" shows only chargers with every chosen kind (saved with the filters).
