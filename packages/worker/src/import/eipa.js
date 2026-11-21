// Imports Poland's official register of alternative fuel infrastructure, EIPA
// (Ewidencja Infrastruktury Paliw Alternatywnych, Urząd Dozoru Technicznego):
// https://eipa.udt.gov.pl/reader/docs. One job for the whole country: the
// register is a set of JSON files, downloaded with the EIPA_TOKEN an account
// gets. A pool (a place) is one charger; its stations and charging points
// make its connectors. Static files allow 10 downloads an hour.

import { deleteUnseen, upsertChargers } from "../db.js";
import { saveSourceMetadata } from "../source-metadata.js";

const SOURCE = "eipa";
const LICENSE = "EIPA, Urząd Dozoru Technicznego";
const BASE_URL = "https://eipa.udt.gov.pl/reader/export-data";
// The files are a few MB; a stalled download would block the import run.
const REQUEST_TIMEOUT_MS = 120 * 1000;
// Stations: E is electric (G is gas, H hydrogen).
const ELECTRIC = "E";
// Which charging point belongs to which pool, for the status refreshes.
const POINT_POOLS_KEY = "point-pools";

const downloadEipa = async (env, file) => {
  const response = await fetch(`${BASE_URL}/${file}/${env.EIPA_TOKEN}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`EIPA ${file}: ${response.status}`);
  }
  return response.json();
};

const listJobs = (env) =>
  Promise.resolve(env.EIPA_TOKEN ? [{ source: SOURCE, area: "PL", priority: 0 }] : []);

// Many pools are named after their address ("Aleje Jerozolimskie 179, 02-222
// Warszawa"): a Polish postal code, or the pool's street at the start.
const POSTAL_CODE = /\b\d{2}-\d{3}\b/;

// The pool's name, unless it's only its address: then other sources' names
// win the merge, and the page names it after its operator.
const nameOf = (pool) => {
  const name = pool.name?.trim().replace(/,$/, "");
  const street = pool.street?.replace(/^(ul\.|al\.|aleje|ulica)\s*/i, "").toLowerCase();
  const isAddress =
    !name ||
    POSTAL_CODE.test(name) ||
    /^(ul\.|al\.)\s/i.test(name) ||
    (street &&
      name
        .toLowerCase()
        .replace(/^(ul\.|al\.|aleje|ulica)\s*/i, "")
        .startsWith(street));
  return isAddress ? null : name;
};

const address = ({ street, house_number: houseNumber, postal_code: postalCode, city }) =>
  [
    [street, houseNumber],
    [postalCode, city],
  ]
    .map((parts) => parts.filter(Boolean).join(" "))
    .filter(Boolean)
    .join(", ");

// The lowest price per unit among the pool's points, e.g. "2.49 PLN/kWh".
const cheapestPrices = (prices) => {
  const byUnit = new Map();
  for (const { price, unit } of prices) {
    const value = Number(price);
    if (Number.isFinite(value) && unit && (!byUnit.has(unit) || value < byUnit.get(unit))) {
      byUnit.set(unit, value);
    }
  }
  return [...byUnit].map(([unit, value]) => `${value.toFixed(2)} PLN/${unit}`).join(", ");
};

// The point's connectors, merged with the same type and power across points.
const addConnectors = (connectors, point, interfaceNames) => {
  for (const connector of point.connectors ?? []) {
    const type = interfaceNames.get(connector.interfaces?.[0]) ?? "Unknown";
    const powerKw = Number(connector.power) || null;
    const same = connectors.find((other) => other.type === type && other.powerKw === powerKw);
    if (same) {
      same.quantity++;
    } else {
      connectors.push({ type, powerKw, quantity: 1 });
    }
  }
};

// The register's files as chargers, and which point belongs to which pool.
const toChargers = ({ pools, stations, points, operators, dictionary, dynamic }) => {
  const interfaceNames = new Map(
    (dictionary.connector_interface ?? []).map(({ id, name }) => [id, name])
  );
  const operatorNames = new Map(
    operators.map(({ id, short_name: shortName, name }) => [id, shortName || name])
  );
  const pricesByPoint = new Map(dynamic.map(({ point_id: id, prices }) => [id, prices ?? []]));
  const poolByStation = new Map(
    stations
      .filter((station) => station.type === ELECTRIC && !station.suspended)
      .map((station) => [station.id, station.pool_id])
  );
  const pointsByPool = new Map();
  const pointPools = {};
  for (const point of points) {
    const poolId = poolByStation.get(point.station_id);
    if (poolId !== undefined) {
      pointsByPool.set(poolId, [...(pointsByPool.get(poolId) ?? []), point]);
      pointPools[point.id] = poolId;
    }
  }
  const chargers = pools
    .filter((pool) => pool.charging && pointsByPool.has(pool.id))
    .map((pool) => {
      const poolPoints = pointsByPool.get(pool.id);
      const connectors = [];
      for (const point of poolPoints) {
        addConnectors(connectors, point, interfaceNames);
      }
      const powers = connectors.map((connector) => connector.powerKw).filter(Boolean);
      return {
        source: SOURCE,
        sourceId: String(pool.id),
        country: "PL",
        name: nameOf(pool),
        lat: pool.latitude,
        lng: pool.longitude,
        address: address(pool),
        operator: operatorNames.get(pool.operator_id),
        usageType: null,
        usageCost: cheapestPrices(poolPoints.flatMap((point) => pricesByPoint.get(point.id) ?? [])),
        status: null,
        numberOfPoints: poolPoints.length,
        maxPowerKw: powers.length ? Math.max(...powers) : null,
        connectors,
        license: LICENSE,
      };
    });
  return { chargers, pointPools };
};

// Imports the whole register; it's small enough for one step.
const runStep = async (env, job) => {
  const [pools, stations, points, operators, dictionary, dynamic] = await Promise.all([
    downloadEipa(env, "pool"),
    downloadEipa(env, "station"),
    downloadEipa(env, "point"),
    downloadEipa(env, "operator"),
    downloadEipa(env, "dictionary"),
    downloadEipa(env, "dynamic"),
  ]);
  const { chargers, pointPools } = toChargers({
    pools: pools.data,
    stations: stations.data,
    points: points.data,
    operators: operators.data,
    dictionary,
    dynamic: dynamic.data,
  });
  await upsertChargers(env.DB, chargers, job.started_at);
  await deleteUnseen(env.DB, {
    source: SOURCE,
    where: "country = ?",
    params: ["PL"],
    seenBefore: job.started_at,
  });
  await saveSourceMetadata(env.DB, SOURCE, POINT_POOLS_KEY, pointPools);
  return { done: true };
};

export { POINT_POOLS_KEY, SOURCE, downloadEipa, listJobs, runStep, toChargers };
