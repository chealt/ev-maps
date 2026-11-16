// Imports chargers from Open Charge Map (https://openchargemap.org), one
// country per job, one page per step. Data is CC BY 4.0, except what Open
// Charge Map imported from other providers, which keeps the provider's
// license: only openly licensed providers are imported.

import { deleteUnseen, upsertChargers } from "../db.js";

const API_URL = "https://api.openchargemap.io/v3";
const SOURCE = "ocm";
const PAGE_SIZE = 1000;
const REFERENCE_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
// A request that never answers would block the whole import run.
const REQUEST_TIMEOUT_MS = 60 * 1000;

// Countries imported first.
const PRIORITY_COUNTRIES = [
  "HU",
  "PL",
  "CZ",
  "SK",
  "RO",
  "BG",
  "HR",
  "SI",
  "RS",
  "BA",
  "ME",
  "MK",
  "AL",
  "XK",
  "LT",
  "LV",
  "EE",
  "UA",
  "MD",
];

const isOpenLicense = ({ License: license = "", IsOpenDataLicensed: isOpen }) =>
  !/non-?commercial|BY-NC/i.test(license) &&
  (isOpen || /CC-?0|CC[ -]BY|Open Government|Etalab/i.test(license));

const apiUrl = (path, params, apiKey) =>
  `${API_URL}/${path}?${new URLSearchParams({ output: "json", key: apiKey, ...params })}`;

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { "user-agent": "ev-maps importer" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Open Charge Map request failed: ${response.status}`);
  }
  return response.json();
};

// Reference data (~0.5 MB) maps IDs to names; cache it at the edge for a day.
const fetchReferenceData = async (apiKey) => {
  const cacheKey = new Request(`${API_URL}/referencedata?cache=ev-maps`);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    return cached.json();
  }
  const data = await fetchJson(apiUrl("referencedata", {}, apiKey));
  await caches.default.put(
    cacheKey,
    new Response(JSON.stringify(data), {
      headers: { "cache-control": `max-age=${REFERENCE_DATA_MAX_AGE_SECONDS}` },
    })
  );
  return data;
};

const byId = (items = []) => new Map(items.map((item) => [item.ID, item]));

const toReference = (data) => ({
  operators: byId(data.Operators),
  usageTypes: byId(data.UsageTypes),
  statusTypes: byId(data.StatusTypes),
  connectionTypes: byId(data.ConnectionTypes),
  dataProviders: byId(data.DataProviders),
  countries: data.Countries ?? [],
});

const maxPowerKw = (connections = []) => {
  const powers = connections.map((connection) => connection.PowerKW).filter(Number.isFinite);
  return powers.length ? Math.max(...powers) : null;
};

const toCharger = (poi, reference) => {
  const address = poi.AddressInfo ?? {};
  return {
    source: SOURCE,
    sourceId: String(poi.ID),
    country: reference.countryCodes.get(address.CountryID) ?? null,
    name: address.Title,
    lat: address.Latitude,
    lng: address.Longitude,
    address: [address.AddressLine1, address.Town, address.StateOrProvince, address.Postcode]
      .filter(Boolean)
      .join(", "),
    operator: reference.operators.get(poi.OperatorID)?.Title,
    usageType: reference.usageTypes.get(poi.UsageTypeID)?.Title,
    usageCost: poi.UsageCost,
    status: reference.statusTypes.get(poi.StatusTypeID)?.Title,
    numberOfPoints: poi.NumberOfPoints,
    maxPowerKw: maxPowerKw(poi.Connections),
    connectors: (poi.Connections ?? []).map((connection) => ({
      type:
        reference.connectionTypes.get(connection.ConnectionTypeID)?.Title || "Unknown connector",
      powerKw: connection.PowerKW ?? null,
      quantity: connection.Quantity ?? null,
    })),
    license: reference.dataProviders.get(poi.DataProviderID)?.License ?? null,
  };
};

const hasLocation = (charger) => Number.isFinite(charger.lat) && Number.isFinite(charger.lng);

// One job per country Open Charge Map knows, Eastern Europe first.
const listJobs = async (env) => {
  const { countries } = toReference(await fetchReferenceData(env.OPEN_CHARGE_MAP_API_KEY));
  return countries.map(({ ISOCode: code }) => ({
    source: SOURCE,
    area: code,
    priority: PRIORITY_COUNTRIES.includes(code) ? 1 : 2,
  }));
};

// Imports the next page of the job's country; returns whether it's done.
const runStep = async (env, job) => {
  const apiKey = env.OPEN_CHARGE_MAP_API_KEY;
  const reference = toReference(await fetchReferenceData(apiKey));
  reference.countryCodes = new Map(reference.countries.map((c) => [c.ID, c.ISOCode]));

  const pois = await fetchJson(
    apiUrl(
      "poi",
      {
        countrycode: job.area,
        maxresults: String(PAGE_SIZE),
        sortby: "id_asc",
        greaterthanid: job.cursor ?? "0",
        compact: "true",
        verbose: "false",
      },
      apiKey
    )
  );

  const chargers = pois
    .filter((poi) => {
      const provider = reference.dataProviders.get(poi.DataProviderID);
      return !provider || isOpenLicense(provider);
    })
    .map((poi) => toCharger(poi, reference))
    .filter(hasLocation);
  await upsertChargers(env.DB, chargers, job.started_at);

  if (pois.length < PAGE_SIZE) {
    await deleteUnseen(env.DB, {
      source: SOURCE,
      where: "country = ?",
      params: [job.area],
      seenBefore: job.started_at,
    });
    return { done: true };
  }
  return { done: false, cursor: String(pois.at(-1).ID) };
};

export { listJobs, runStep, SOURCE };
