# Route planner

The Route button opens `<ev-route-planner>`, with From
and To fields (`<ev-place-input>`) that suggest places with Google's Places
API (New) and include an `×` clear button while filled. Signed in, a chosen
place can be saved to the account (`savedPlaces` in `route-history.js`) with
a preset (Home, Work, School) or a custom label and icon from the available
icons, and chosen for From or To from the saved-place chips under each field
(see [Saved places](saved-places.md)).
Google's Routes library plans the route, and the Worker's
`POST /api/chargers/route` returns the chargers within 5 km of it, in order
along the route: it splits the route into chunks of about 20 km, queries the
R*Tree for each chunk's box in one D1 batch, and measures each charger's
distance to the route (`packages/worker/src/route.js`). The map then shows
the route and its chargers, with the same power filters, until the route is
cleared. Under To, the planner shows the route's whole distance and
driving time (Google's `distanceMeters` and `durationMillis`, e.g. "Route:
243 km, 2 hr 40 min by car"), in the user's distance unit.

The shown route's places (origin, destination and any stops) are kept in
IndexedDB (`saved-state.js`): a Google place by its ID, or a location, with
its label. Signed in, a reload plans it again and puts its places back in
the route planner, until it's cleared or the user signs out. A charger's
details also offer "Add stop", which adds or removes the charger as an
intermediate stop along the route (re-planning right away if a route is
shown, or opening the planner with the stop listed between From and To).
Routes have their own request counter, so the map's tile loads can't cancel
one, while a route cancels theirs.

Signed in, the routes planned are kept in the account's settings as a
`routeHistory` section (`route-history.js`): the last 10, the latest first,
each with the filters on when it was planned. The route planner lists them
("Recent routes", with how many filters), and choosing one puts its filters
back on and plans it again, moving it to the top with the filters of this
time. Planning the same route again doesn't duplicate it, and signing out
forgets the list.
