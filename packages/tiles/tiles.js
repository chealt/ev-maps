// Web Mercator tile maths, shared by the client and the Worker: chargers are
// loaded and cached per tile, so the same area always means the same request.

// The format of the tile API's chargers. Bump it with every change to their
// shape: the app asks for /api/chargers/{z}/{x}/{y}?v={version}, and the
// Worker caches tiles by it, so no cache (the edge, the browser or the service
// worker) serves the old format afterwards.
const TILE_FORMAT_VERSION = 2;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const lngToTileX = (lng, zoom) => Math.floor(((lng + 180) / 360) * 2 ** zoom);

const latToTileY = (lat, zoom) => {
  const radians = (clamp(lat, -85.0511, 85.0511) * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom
  );
};

const tileXToLng = (x, zoom) => (x / 2 ** zoom) * 360 - 180;

const tileYToLat = (y, zoom) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** zoom))) * 180) / Math.PI;

const tileBounds = ({ x, y, zoom }) => ({
  north: tileYToLat(y, zoom),
  south: tileYToLat(y + 1, zoom),
  west: tileXToLng(x, zoom),
  east: tileXToLng(x + 1, zoom),
});

const tilesInBounds = ({ north, south, east, west }, zoom) => {
  const lastTile = 2 ** zoom - 1;
  const minX = clamp(lngToTileX(west, zoom), 0, lastTile);
  const maxX = clamp(lngToTileX(east, zoom), 0, lastTile);
  const minY = clamp(latToTileY(north, zoom), 0, lastTile);
  const maxY = clamp(latToTileY(south, zoom), 0, lastTile);
  const tiles = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ x, y, zoom });
    }
  }
  return tiles;
};

const intersects = (a, b) =>
  a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south;

const childTiles = ({ x, y, zoom }) =>
  [0, 1].flatMap((dx) => [0, 1].map((dy) => ({ x: 2 * x + dx, y: 2 * y + dy, zoom: zoom + 1 })));

export { TILE_FORMAT_VERSION, childTiles, clamp, intersects, tileBounds, tilesInBounds };
