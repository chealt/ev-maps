# Route planner

The Route button opens `<ev-route-planner>`, with From
and To fields (`<ev-place-input>`) that suggest places with Google's Places
API (New). Google's Routes library plans the route, and the Worker's
`POST /api/chargers/route` returns the chargers within 5 km of it, in order
along the route: it splits the route into chunks of about 20 km, queries the
R*Tree for each chunk's box in one D1 batch, and measures each charger's
distance to the route (`packages/worker/src/route.js`). The map then shows
the route and its chargers, with the same power filters, until the route is
cleared.

The shown route's places are kept in IndexedDB (`saved-state.js`): a
Google place by its ID, or a location, with its label. Signed in, a reload
plans it again and puts its places back in the route planner, until it's
cleared or the user signs out. Routes have their own request counter, so
the map's tile loads can't cancel one, while a route cancels theirs.
