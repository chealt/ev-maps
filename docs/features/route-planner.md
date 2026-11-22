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
