// Exports the chargers in D1 as one JSON file per country, {country}.json
// (lowercase ISO 3166-1 code), in the shape the app uses. The app builds a
// static page for every country from them.
//
//   bun run export -- --out <directory> [--remote]
//
// Without --remote it reads the local database `bun run dev` uses.

import { execFileSync } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { iso1A2Code } from "@rapideditor/country-coder";
import { toClientCharger } from "../src/db.js";
import { withoutDuplicates } from "../src/duplicates.js";

// Rows per query; wrangler prints every result, so keep each one modest.
const PAGE_SIZE = 5000;
// About 10 cm, plenty for a map and much shorter than the stored doubles.
const COORDINATE_DECIMALS = 6;

const {
  values: { out, remote },
} = parseArgs({
  options: { out: { type: "string" }, remote: { type: "boolean", default: false } },
});

if (!out) {
  console.error("Usage: bun run export -- --out <directory> [--remote]");
  process.exit(1);
}

// Cloudflare's code for an API token without access to D1.
const UNAUTHORIZED_CODE = 7403;

// wrangler --json prints errors as JSON on stdout.
const failWithWranglerError = (output) => {
  const { error } = JSON.parse(output || "{}");
  if (!error) {
    return;
  }
  console.error(
    [error.text, ...(error.notes ?? []).map((note) => note.text)].filter(Boolean).join("\n")
  );
  if (error.code === UNAUTHORIZED_CODE) {
    console.error("The Cloudflare API token needs D1 access (D1: Edit, or at least D1: Read).");
  }
  process.exit(1);
};

const query = (sql) => {
  const args = ["d1", "execute", "ev-maps", remote ? "--remote" : "--local", "--json"];
  try {
    const output = execFileSync("wrangler", [...args, "--command", sql], {
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    });
    return JSON.parse(output)[0].results;
  } catch (error) {
    failWithWranglerError(error.stdout);
    throw error;
  }
};

const readAllChargers = () => {
  const rows = [];
  let lastRid = 0;
  for (;;) {
    const page = query(
      `SELECT * FROM chargers WHERE rid > ${lastRid} ORDER BY rid LIMIT ${PAGE_SIZE}`
    );
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return rows;
    }
    lastRid = page.at(-1).rid;
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
      byCountry.set(country, [...(byCountry.get(country) ?? []), toPageCharger(row)]);
    }
  }
  return byCountry;
};

const directory = resolve(out);
await mkdir(directory, { recursive: true });
for (const file of await readdir(directory)) {
  if (file.endsWith(".json")) {
    await rm(join(directory, file));
  }
}

const byCountry = groupByCountry(readAllChargers());
for (const [country, chargers] of [...byCountry].sort(([a], [b]) => a.localeCompare(b))) {
  const unique = withoutDuplicates(chargers).sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(join(directory, `${country}.json`), JSON.stringify(unique));
  console.log(`${country}: ${unique.length} chargers`);
}
