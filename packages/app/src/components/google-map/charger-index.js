// The chargers' filtering and clustering, without the DOM: run in a Web
// Worker (./charger-worker.js), so building and querying the cluster index
// makes no long task on the main thread, or in the page itself where there
// are no module workers (./charger-index-client.js).
//
// It keeps the loaded chargers and the index of the ones that match the
// filters, and answers with charger IDs, which the page maps back to its own
// copies of the chargers.

import Supercluster from "supercluster";

const CLUSTER_RADIUS = 60;
const CLUSTER_MAX_ZOOM = 16;
// Supercluster's tile extent; with the radius, how close pins cluster.
const CLUSTER_EXTENT = 256;

// A charger's operator as the operator filter knows it; "" is unknown.
const operatorOf = (charger) => charger.operator?.trim() ?? "";

// With no connector type active, every charger matches; otherwise it needs a
// connector of one of the active types.
const matchesConnectors = (charger, types) =>
  types.size === 0 || charger.connectors.some((connector) => types.has(connector.type));

// With no range active, every charger matches, including those without power
// data; otherwise its fastest connector must be in one of the active ranges.
const matchesPower = (charger, ranges) => {
  if (!ranges.length) {
    return true;
  }
  const power = charger.maxPowerKw;
  return power != null && ranges.some((range) => power >= range.minKw && power < range.maxKw);
};

const toFeature = (charger) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [charger.location.lng, charger.location.lat] },
  properties: { chargerId: charger.id },
});

// A feature as the page draws it: a cluster with its count, or a charger's ID.
const toResult = ({ geometry, properties }) =>
  properties.cluster
    ? {
        coordinates: geometry.coordinates,
        clusterId: properties.cluster_id,
        count: properties.point_count,
      }
    : { coordinates: geometry.coordinates, chargerId: properties.chargerId };

class ChargerIndex {
  chargers = [];
  index = null;

  setChargers(chargers) {
    this.chargers = chargers;
    this.index = null;
  }

  // Indexes the chargers matching the filters and returns their IDs. Filters:
  // { ranges: [{ minKw, maxKw }], connectorTypes: [], excludedOperators: [],
  //   favoriteIds: [] or null for any, unavailableIds: [] to hide (the live
  //   statuses are the page's), amenities: [] }.
  filter({ ranges, connectorTypes, excludedOperators, favoriteIds, unavailableIds, amenities }) {
    const types = new Set(connectorTypes);
    const excluded = new Set(excludedOperators);
    const favorites = favoriteIds ? new Set(favoriteIds) : null;
    const unavailable = new Set(unavailableIds ?? []);
    const matching = this.chargers.filter(
      (charger) =>
        matchesPower(charger, ranges) &&
        matchesConnectors(charger, types) &&
        !excluded.has(operatorOf(charger)) &&
        (!favorites || favorites.has(charger.id)) &&
        !unavailable.has(charger.id) &&
        amenities.every((amenity) => charger.amenities?.includes(amenity))
    );
    this.index = new Supercluster({
      radius: CLUSTER_RADIUS,
      extent: CLUSTER_EXTENT,
      maxZoom: CLUSTER_MAX_ZOOM,
    }).load(matching.map(toFeature));
    return matching.map((charger) => charger.id);
  }

  // The clusters and chargers to draw in a box ([west, south, east, north]).
  clusters(box, zoom) {
    return (this.index?.getClusters(box, zoom) ?? []).map(toResult);
  }

  expansionZoom(clusterId) {
    return this.index?.getClusterExpansionZoom(clusterId) ?? CLUSTER_MAX_ZOOM + 1;
  }

  // Whether any charger of the cluster is one of these IDs.
  clusterHas(clusterId, chargerIds) {
    const ids = new Set(chargerIds);
    try {
      return this.index
        .getLeaves(clusterId, Infinity)
        .some(({ properties }) => ids.has(properties.chargerId));
    } catch {
      // A cluster of an index replaced since.
      return false;
    }
  }

  // The lowest zoom from `fromZoom` at which the charger has its own pin
  // instead of being part of a cluster.
  unclusteredZoom({ id, location }, fromZoom) {
    const { lat, lng } = location;
    const around = [lng - 1e-6, lat - 1e-6, lng + 1e-6, lat + 1e-6];
    for (let zoom = fromZoom; zoom <= CLUSTER_MAX_ZOOM; zoom++) {
      const features = this.index?.getClusters(around, zoom) ?? [];
      if (features.some(({ properties }) => !properties.cluster && properties.chargerId === id)) {
        return zoom;
      }
    }
    return CLUSTER_MAX_ZOOM + 1;
  }
}

export { ChargerIndex, operatorOf };
