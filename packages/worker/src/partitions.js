// Splits per-charger data into a fixed number of parts by charger ID, so
// large sources (France has over 50,000 chargers) fit D1's 2 MB per value and
// readers load only the parts they need.

const PARTS = 16;

// FNV-1a: a fast, stable hash of the ID.
const partOf = (id) => {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % PARTS;
};

// { id: value } -> [{ id: value }, ...], PARTS long.
const splitByPart = (byId) => {
  const parts = Array.from({ length: PARTS }, () => ({}));
  for (const [id, value] of Object.entries(byId)) {
    parts[partOf(id)][id] = value;
  }
  return parts;
};

export { PARTS, partOf, splitByPart };
