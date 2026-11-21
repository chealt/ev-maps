// Merges the records different sources have for the same charger into one.
// Used by the tile API, the route API and the export for the country pages.

// Records from different sources this close are taken to be the same charger.
const DUPLICATE_DISTANCE_METERS = 60;
const METERS_PER_DEGREE_LAT = 111320;
// Which source's value wins for each field: official registers, then Open
// Charge Map, then OpenStreetMap. Sources not listed rank last.
const SOURCE_RANK = { ocm: 1, osm: 2 };
const UNRANKED = 9;
// Fields taken from the best record that has them.
const MERGED_FIELDS = [
  "name",
  "address",
  "operator",
  "access",
  "usageCost",
  "free",
  "status",
  "numberOfPoints",
];

const rankOf = ({ source }) => SOURCE_RANK[source] ?? UNRANKED;

// Prefer the record with the most detail.
const detailScore = (charger) =>
  charger.connectors.filter((connector) => connector.powerKw).length * 2 +
  (charger.status ? 1 : 0) +
  (charger.address ? 1 : 0);

// Higher-ranked sources first; within a source, the most detailed record.
const byPreference = (a, b) => rankOf(a) - rankOf(b) || detailScore(b) - detailScore(a);

// Approximate distance in meters; fine at these small distances.
const metersBetween = (a, b) => {
  const dLat = (a.lat - b.lat) * METERS_PER_DEGREE_LAT;
  const dLng = (a.lng - b.lng) * METERS_PER_DEGREE_LAT * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
};

const hasValue = (value) => value !== undefined && value !== null && value !== "";

// One charger from a group's records, best first: each field from the first
// record that has it, the connectors and power from the first with power
// (else with any connectors), and every source.
const mergeGroup = ([best, ...others]) => {
  if (!others.length) {
    return best;
  }
  const records = [best, ...others];
  const merged = { ...best };
  for (const field of MERGED_FIELDS) {
    merged[field] = records.map((record) => record[field]).find(hasValue);
  }
  const withConnectors =
    records.find((record) => record.connectors.some((connector) => connector.powerKw)) ??
    records.find((record) => record.connectors.length);
  merged.connectors = withConnectors?.connectors ?? [];
  merged.maxPowerKw = records.map((record) => record.maxPowerKw).find(hasValue) ?? null;
  merged.sources = records.map(({ source }) => source);
  return merged;
};

// Groups records of the same charger: a record joins the nearest group within
// DUPLICATE_DISTANCE_METERS that has nothing from its source yet. Records
// from the same source are never merged: separate chargers at one car park
// are real. A grid of cells as large as the distance means only a record's
// own and neighboring cells need checking.
const mergeDuplicates = (chargers) => {
  const cellSize = DUPLICATE_DISTANCE_METERS / METERS_PER_DEGREE_LAT;
  const cellOf = ({ lat, lng }) => [Math.floor(lat / cellSize), Math.floor(lng / cellSize)];
  const groupsByCell = new Map();
  const groups = [];
  for (const charger of [...chargers].sort(byPreference)) {
    const [row, column] = cellOf(charger.location);
    let nearest = null;
    let nearestMeters = Infinity;
    for (const dRow of [-1, 0, 1]) {
      for (const dColumn of [-1, 0, 1]) {
        for (const group of groupsByCell.get(`${row + dRow},${column + dColumn}`) ?? []) {
          const meters = metersBetween(group.location, charger.location);
          if (
            meters <= DUPLICATE_DISTANCE_METERS &&
            meters < nearestMeters &&
            !group.records.some((record) => record.source === charger.source)
          ) {
            nearest = group;
            nearestMeters = meters;
          }
        }
      }
    }
    if (nearest) {
      nearest.records.push(charger);
    } else {
      const group = { location: charger.location, records: [charger] };
      groups.push(group);
      const key = `${row},${column}`;
      groupsByCell.set(key, [...(groupsByCell.get(key) ?? []), group]);
    }
  }
  return groups.map(({ records }) => mergeGroup(records));
};

export { mergeDuplicates };
