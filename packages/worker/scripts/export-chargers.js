// Exports the chargers in D1 as one JSON file per country, {country}.json
// (lowercase ISO 3166-1 code), in the shape the app uses. The app builds a
// static page for every country from them.
//
//   bun run export -- --out <directory> [--remote]
//
// It runs on Node, not Bun: Wrangler's remote bindings don't work under Bun
// (https://github.com/oven-sh/bun/issues/39247).
//
// Without --remote it reads the local database `bun run dev` uses; with it,
// the production database, through Wrangler's remote bindings
// (wrangler.export.toml), with your `wrangler login` or CLOUDFLARE_API_TOKEN.

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { iso1A2Code } from "@rapideditor/country-coder";
import { getPlatformProxy } from "wrangler";
import { chargersAfter, toClientCharger } from "../src/db.js";
import { mergeDuplicates } from "../src/duplicates.js";

const PAGE_SIZE = 5000;
// About 10 cm, plenty for a map and much shorter than the stored doubles.
const COORDINATE_DECIMALS = 6;
const CONFIG_PATH = new URL("../wrangler.toml", import.meta.url).pathname;
const REMOTE_CONFIG_PATH = new URL("../wrangler.export.toml", import.meta.url).pathname;

const {
  values: { out, remote },
} = parseArgs({
  options: { out: { type: "string" }, remote: { type: "boolean", default: false } },
});

if (!out) {
  console.error("Usage: bun run export -- --out <directory> [--remote]");
  process.exit(1);
}

const readAllChargers = async (db) => {
  const rows = [];
  for (;;) {
    const page = await chargersAfter(db, rows.at(-1)?.rid ?? 0, PAGE_SIZE);
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
};

const roundCoordinate = (value) => Number(value.toFixed(COORDINATE_DECIMALS));

const toPageCharger = (row) => {
  const charger = toClientCharger(row);
  const { lat, lng } = charger.location;
  return { ...charger, location: { lat: roundCoordinate(lat), lng: roundCoordinate(lng) } };
};

// Older OpenStreetMap rows were imported before the country was looked up.
const countryOf = (row) => row.country ?? iso1A2Code([row.lng, row.lat]);

const groupByCountry = (rows) => {
  const byCountry = new Map();
  for (const row of rows) {
    const country = countryOf(row)?.toLowerCase();
    if (country) {
      if (!byCountry.has(country)) {
        byCountry.set(country, []);
      }
      byCountry.get(country).push(toPageCharger(row));
    }
  }
  return byCountry;
};

const readDatabase = async () => {
  const { env, dispose } = remote
    ? await getPlatformProxy({ configPath: REMOTE_CONFIG_PATH })
    : await getPlatformProxy({ configPath: CONFIG_PATH, environment: "local" });
  try {
    return await readAllChargers(env.DB);
  } finally {
    await dispose();
  }
};

// Wrangler's errors carry Cloudflare's explanation in notes, on the error or
// its cause.
const describeError = (error) =>
  [error, error?.cause]
    .filter(Boolean)
    .flatMap((part) => [part.message ?? part.text, ...(part.notes ?? []).map((note) => note.text)])
    .filter(Boolean)
    .join("\n");

const failWith = (error) => {
  const description = describeError(error);
  console.error(`Export failed: ${description}`);
  if (/\b(7403|9106|10000)\b|not authorized|authentication/i.test(description)) {
    console.error(
      "Check the Cloudflare login: `bunx wrangler login`, or CLOUDFLARE_API_TOKEN with D1 and Workers Scripts access."
    );
  }
  process.exit(1);
};

// Read first, so a failed export leaves the previous files in place.
const byCountry = groupByCountry(await readDatabase().catch(failWith));

const directory = resolve(out);
await mkdir(directory, { recursive: true });
for (const file of await readdir(directory)) {
  if (file.endsWith(".json")) {
    await rm(join(directory, file));
  }
}
for (const [country, chargers] of [...byCountry].sort(([a], [b]) => a.localeCompare(b))) {
  const unique = mergeDuplicates(chargers).sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(join(directory, `${country}.json`), JSON.stringify(unique));
  console.log(`${country}: ${unique.length} chargers`);
}
