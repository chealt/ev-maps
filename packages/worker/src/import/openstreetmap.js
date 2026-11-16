// Imports charging stations from OpenStreetMap through the Overpass API, one
// 1°×1° grid cell per job, across Eastern Europe. OpenStreetMap data is
// © OpenStreetMap contributors, licensed under the ODbL.

import { deleteUnseen, upsertChargers } from "../db.js";

const SOURCE = "osm";
const LICENSE = "ODbL 1.0, © OpenStreetMap contributors";
// Public Overpass instances are often overloaded; try them in turn.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
// Eastern Europe: from the Adriatic and the Baltic to Ukraine.
const REGION = { south: 39, north: 60, west: 12, east: 41 };
// Overpass queries time out after 60 s on the server; an overloaded instance
// may never answer, which would block the whole import run.
const REQUEST_TIMEOUT_MS = 90 * 1000;

const CONNECTOR_NAMES = {
  type1: "Type 1 (J1772)",
  type1_combo: "CCS (Type 1)",
  type2: "Type 2",
  type2_cable: "Type 2 (tethered)",
  type2_combo: "CCS (Type 2)",
  chademo: "CHAdeMO",
  tesla_supercharger: "Tesla Supercharger",
  tesla_destination: "Tesla Destination",
  nacs: "NACS",
  schuko: "Schuko",
  cee_blue: "CEE (blue)",
  cee_red_16a: "CEE (red, 16 A)",
  cee_red_32a: "CEE (red, 32 A)",
  gb_t_dc: "GB/T DC",
};

// "150 kW", "22kW", "22" (kW), "3.7 kW"
const parseKw = (value) => {
  const match = /([\d.]+)\s*(kw|w)?/i.exec(value ?? "");
  if (!match) {
    return null;
  }
  const number = Number(match[1]);
  return match[2]?.toLowerCase() === "w" ? number / 1000 : number;
};

const toConnectors = (tags) =>
  Object.keys(tags)
    .map((key) => /^socket:([a-z0-9_]+)$/.exec(key)?.[1])
    .filter((socket) => socket && tags[`socket:${socket}`] !== "no")
    .map((socket) => ({
      type: CONNECTOR_NAMES[socket] ?? socket.replaceAll("_", " "),
      powerKw: parseKw(tags[`socket:${socket}:output`]),
      quantity: Number.parseInt(tags[`socket:${socket}`], 10) || null,
    }));

const toCharger = (element) => {
  const tags = element.tags ?? {};
  const connectors = toConnectors(tags);
  const powers = connectors.map((connector) => connector.powerKw).filter(Number.isFinite);
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  return {
    source: SOURCE,
    sourceId: `${element.type}/${element.id}`,
    country: tags["addr:country"] ?? null,
    name: tags.name ?? tags.brand ?? tags.operator ?? tags.network,
    lat: element.lat ?? element.center?.lat,
    lng: element.lon ?? element.center?.lon,
    address: [street, tags["addr:city"], tags["addr:postcode"]].filter(Boolean).join(", "),
    operator: tags.operator ?? tags.network,
    usageType: tags.access,
    usageCost: tags.charge ?? (tags.fee === "no" ? "Free" : undefined),
    status: undefined,
    numberOfPoints: Number.parseInt(tags.capacity, 10) || null,
    maxPowerKw: powers.length ? Math.max(...powers) : null,
    connectors,
    license: LICENSE,
  };
};

const cellBounds = (area) => {
  const [south, west] = area.split(",").map(Number);
  return { south, west, north: south + 1, east: west + 1 };
};

const query = ({ south, west, north, east }) =>
  `[out:json][timeout:60];nwr["amenity"="charging_station"](${south},${west},${north},${east});out center tags;`;

const fetchElements = async (bounds) => {
  const errors = [];
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: query(bounds) }),
        headers: { "user-agent": "ev-maps importer (https://ev-maps.chealt.workers.dev)" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) {
        return (await response.json()).elements ?? [];
      }
      errors.push(`${new URL(url).host}: ${response.status}`);
    } catch (error) {
      errors.push(`${new URL(url).host}: ${error.message}`);
    }
  }
  throw new Error(`Overpass failed: ${errors.join("; ")}`);
};

const hasLocation = (charger) => Number.isFinite(charger.lat) && Number.isFinite(charger.lng);

// One job per 1°×1° cell of the region; the area is "south,west".
const listJobs = async () => {
  const jobs = [];
  for (let south = REGION.south; south < REGION.north; south++) {
    for (let west = REGION.west; west < REGION.east; west++) {
      jobs.push({ source: SOURCE, area: `${south},${west}`, priority: 1 });
    }
  }
  return jobs;
};

// Imports a whole cell in one step.
const runStep = async (env, job) => {
  const bounds = cellBounds(job.area);
  const chargers = (await fetchElements(bounds)).map(toCharger).filter(hasLocation);
  await upsertChargers(env.DB, chargers, job.started_at);
  await deleteUnseen(env.DB, {
    source: SOURCE,
    where: "lat >= ? AND lat < ? AND lng >= ? AND lng < ?",
    params: [bounds.south, bounds.north, bounds.west, bounds.east],
    seenBefore: job.started_at,
  });
  return { done: true };
};

export { listJobs, runStep, SOURCE };
