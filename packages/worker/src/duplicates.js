// Merges chargers that different sources list for the same place. Used by the
// tile API and the export for the country pages.

// Chargers from different sources this close are taken to be the same one.
const DUPLICATE_DISTANCE_METERS = 60;
const METERS_PER_DEGREE_LAT = 111320;

// Prefer the record with the most detail.
const detailScore = (charger) =>
  charger.connectors.filter((connector) => connector.powerKw).length * 2 +
  (charger.status ? 1 : 0) +
  (charger.address ? 1 : 0);

// Approximate distance in meters; fine at these small distances.
const metersBetween = (a, b) => {
  const dLat = (a.lat - b.lat) * METERS_PER_DEGREE_LAT;
  const dLng = (a.lng - b.lng) * METERS_PER_DEGREE_LAT * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
};

// Drops a charger when another source has one within
// DUPLICATE_DISTANCE_METERS, keeping the record with the most detail. Chargers
// from the same source are never merged: separate ones at one car park are
// real. Uses a grid of cells as large as the distance, so only a charger's
// own and neighboring cells need checking.
const withoutDuplicates = (chargers) => {
  const cellSize = DUPLICATE_DISTANCE_METERS / METERS_PER_DEGREE_LAT;
  const cellOf = ({ lat, lng }) => [Math.floor(lat / cellSize), Math.floor(lng / cellSize)];
  const keptByCell = new Map();
  const kept = [];
  for (const charger of [...chargers].sort((a, b) => detailScore(b) - detailScore(a))) {
    const [row, column] = cellOf(charger.location);
    const neighbors = [-1, 0, 1].flatMap((dRow) =>
      [-1, 0, 1].flatMap((dColumn) => keptByCell.get(`${row + dRow},${column + dColumn}`) ?? [])
    );
    const isDuplicate = neighbors.some(
      (other) =>
        other.source !== charger.source &&
        metersBetween(other.location, charger.location) <= DUPLICATE_DISTANCE_METERS
    );
    if (!isDuplicate) {
      kept.push(charger);
      const key = `${row},${column}`;
      keptByCell.set(key, [...(keptByCell.get(key) ?? []), charger]);
    }
  }
  return kept;
};

export { withoutDuplicates };
