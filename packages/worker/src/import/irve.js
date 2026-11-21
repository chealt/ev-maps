// Imports France's national register of charging points, IRVE
// (Infrastructures de Recharge pour Véhicules Électriques), consolidated by
// transport.data.gouv.fr: one CSV row per charging point (point de charge),
// grouped into stations (one charger each). The file is over 100 MB, so it's
// parsed as it downloads, and imported in PASSES steps: each keeps only a
// share of the stations, as a station's rows are spread through the file and
// all of them wouldn't fit a Worker's memory. Open data, Licence Ouverte 2.0
// (attribution).
// https://transport.data.gouv.fr/datasets/base-nationale-des-irve-infrastructures-de-recharge-pour-vehicules-electriques

import { csvRows } from "../csv.js";
import { deleteUnseen, upsertChargers } from "../db.js";
import { partOf } from "../partitions.js";
import { saveSourceMetadata } from "../source-metadata.js";

const SOURCE = "irve";
const LICENSE = "Licence Ouverte 2.0, transport.data.gouv.fr (IRVE)";
const STATIC_URL =
  "https://proxy.transport.data.gouv.fr/resource/consolidation-transport-irve-statique";
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
// Which charging point belongs to which station, for the status refreshes:
// one key per pass, "point-stations-0" and so on.
const POINT_STATIONS_KEY = "point-stations";
const PASSES = 4;
// Long tariff descriptions are cut, as the details panel shows one line.
const MAX_COST_LENGTH = 160;
// AC connectors can't charge faster than this; a point's power above it is
// its DC connectors'.
const MAX_AC_KW = 43;
// The point's connector flags, as our connector IDs; DC ones first.
const CONNECTOR_FLAGS = [
  { flag: "prise_type_combo_ccs", type: "ccs2", dc: true },
  { flag: "prise_type_chademo", type: "chademo", dc: true },
  { flag: "prise_type_2", type: "type2-socket", tethered: "type2-tethered" },
  { flag: "prise_type_ef", type: "schuko" },
  { flag: "prise_type_autre", type: "unknown" },
];

const listJobs = () => Promise.resolve([{ source: SOURCE, area: "FR", priority: 0 }]);

const isTrue = (value) => value?.toLowerCase() === "true";

// Watts by mistake in some files: 22000 means 22 kW.
const kilowatts = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return number > 1000 ? number / 1000 : number;
};

// [lng, lat] as text, or the consolidation's own columns.
const locationOf = (row) => {
  const lat = Number(row.consolidated_latitude);
  const lng = Number(row.consolidated_longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) {
    return { lat, lng };
  }
  const match = /\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/.exec(row.coordonneesXY ?? "");
  return match ? { lat: Number(match[2]), lng: Number(match[1]) } : null;
};

// The point's connectors: its power goes to the DC ones, and to an AC one
// only if the point has no DC connector and the power fits AC.
const pointConnectors = (row) => {
  const powerKw = kilowatts(row.puissance_nominale);
  const present = CONNECTOR_FLAGS.filter(({ flag }) => isTrue(row[flag]));
  const hasDc = present.some(({ dc }) => dc);
  return present.map(({ type, dc, tethered }) => ({
    type: tethered && isTrue(row.cable_t2_attache) ? tethered : type,
    powerKw: dc || (!hasDc && powerKw && powerKw <= MAX_AC_KW) ? powerKw : null,
  }));
};

const addConnectors = (connectors, row) => {
  for (const { type, powerKw } of pointConnectors(row)) {
    const same = connectors.find((other) => other.type === type && other.powerKw === powerKw);
    if (same) {
      same.quantity++;
    } else {
      connectors.push({ type, powerKw, quantity: 1 });
    }
  }
};

// Groups the rows (charging points) into chargers, one per station, and maps
// each point to its station; only the stations of pass `pass`, if given.
const toChargers = async (rows, { pass, passes = PASSES } = {}) => {
  const stations = new Map();
  const pointStations = {};
  for await (const row of rows) {
    const id = row.id_station_itinerance;
    if (!id || (pass !== undefined && partOf(id) % passes !== pass)) {
      continue;
    }
    const location = locationOf(row);
    if (!location) {
      continue;
    }
    let station = stations.get(id);
    if (!station) {
      station = {
        source: SOURCE,
        sourceId: id,
        country: "FR",
        name: row.nom_station?.trim() || null,
        lat: location.lat,
        lng: location.lng,
        address: row.adresse_station?.trim() || null,
        operator: row.nom_enseigne?.trim() || row.nom_operateur?.trim() || null,
        usageType: row.condition_acces || null,
        usageCost: isTrue(row.gratuit)
          ? "Free"
          : row.tarification?.trim().slice(0, MAX_COST_LENGTH) || null,
        status: null,
        numberOfPoints: 0,
        maxPowerKw: null,
        connectors: [],
        license: LICENSE,
      };
      stations.set(id, station);
    }
    station.numberOfPoints++;
    const powerKw = kilowatts(row.puissance_nominale);
    if (powerKw && powerKw > (station.maxPowerKw ?? 0)) {
      station.maxPowerKw = powerKw;
    }
    addConnectors(station.connectors, row);
    if (row.id_pdc_itinerance) {
      pointStations[row.id_pdc_itinerance] = id;
    }
  }
  return { chargers: [...stations.values()], pointStations };
};

const downloadCsv = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`IRVE ${url}: ${response.status}`);
  }
  return csvRows(response.body.pipeThrough(new TextDecoderStream()));
};

// One pass per step; the cursor is the next pass. Chargers no longer listed
// are removed after the last one.
const runStep = async (env, job) => {
  const pass = Number(job.cursor ?? 0);
  const { chargers, pointStations } = await toChargers(await downloadCsv(STATIC_URL), { pass });
  await upsertChargers(env.DB, chargers, job.started_at);
  await saveSourceMetadata(env.DB, SOURCE, `${POINT_STATIONS_KEY}-${pass}`, pointStations);
  if (pass < PASSES - 1) {
    return { done: false, cursor: String(pass + 1) };
  }
  await deleteUnseen(env.DB, {
    source: SOURCE,
    where: "country = ?",
    params: ["FR"],
    seenBefore: job.started_at,
  });
  return { done: true };
};

export { PASSES, POINT_STATIONS_KEY, SOURCE, downloadCsv, listJobs, runStep, toChargers };
