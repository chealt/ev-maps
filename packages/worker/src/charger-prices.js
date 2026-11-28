// Chargers' price history (#463). Sources with live prices (EIPA) are
// gathered hourly, with the live statuses' download (src/live-status.js):
// each charger's cheapest price per kWh is compared with its latest, and
// only changes are stored (charger_prices), so an hour is a few writes. A
// charger's history is those changes expanded to one price per hour; its
// last 30 days give its pattern: its usual price, and the hours of the day
// and days of the week it's much cheaper or pricier than usual.
//
// - GET /api/chargers/prices?ids=eipa:1: a charger's last 30 days, hourly,
//   and its pattern (signed in, as live availability)
// - GET /api/admin/prices?charger=eipa:1: what's tracked, the latest
//   changes, and a charger's history (admin); the admin page
//   /{lang}/admin/prices/ is rendered on the server with the same data
//   (listAdminPrices, src/admin-area.js)

const PRICES_PATH = "/api/chargers/prices";
const ADMIN_PRICES_PATH = "/api/admin/prices";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// The pattern looks at this many days.
const PATTERN_DAYS = 30;
// Changes are kept this long (and each charger's latest, however old).
const RETENTION_DAYS = 90;
// Old changes are cleaned up in the run of this UTC hour.
const CLEANUP_HOUR = 3;
// A pattern needs this many hours with a price.
const MIN_PATTERN_HOURS = 72;
// An hour or a day is "much" cheaper or pricier this far from the usual.
const DEVIATION = 0.1;
// D1 binds up to 100 values per statement.
const ROWS_PER_INSERT = 30;
const BATCH_SIZE = 25;
const MAX_RECENT_CHANGES = 50;
const MAX_IDS = 10;

// The sources with live prices: their time zone (for the hours and days)
// and unit.
const PRICE_SOURCES = {
  eipa: { timeZone: "Europe/Warsaw", unit: "PLN/kWh" },
};

// The browser keeps a charger's history a few minutes: it changes hourly.
const json = (data, cacheControl = "private, max-age=300") =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cacheControl },
  });

const hourOf = (time) => Math.floor(new Date(time).getTime() / HOUR_MS) * HOUR_MS;

// EIPA's dynamic file as { "eipa:1": cheapest price per kWh } by pool.
const eipaPrices = (data, pointPools) => {
  const byCharger = {};
  for (const { point_id: pointId, prices } of data) {
    const poolId = pointPools[pointId];
    if (poolId === undefined) {
      continue;
    }
    for (const { price, unit } of prices ?? []) {
      const value = Number(price);
      const id = `eipa:${poolId}`;
      if (unit === "kWh" && Number.isFinite(value) && value > 0) {
        byCharger[id] = Math.min(byCharger[id] ?? Infinity, value);
      }
    }
  }
  return byCharger;
};

const chunked = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  );

const runBatches = async (db, statements) => {
  for (const batch of chunked(statements, BATCH_SIZE)) {
    await db.batch(batch);
  }
};

// Stores the source's prices of `hour` where they changed: a charger with
// no price now that had one gets a null row.
const recordPrices = async (db, source, prices, hour) => {
  const { results } = await db
    .prepare("SELECT charger_id, price FROM charger_price_latest WHERE source = ?")
    .bind(source)
    .all();
  const latest = new Map(results.map((row) => [row.charger_id, row.price]));
  const changes = Object.entries(prices).filter(([id, price]) => latest.get(id) !== price);
  for (const [id, price] of latest) {
    if (price !== null && !(id in prices)) {
      changes.push([id, null]);
    }
  }
  const statements = chunked(changes, ROWS_PER_INSERT).flatMap((rows) => [
    db
      .prepare(
        `INSERT INTO charger_prices (charger_id, recorded_at, price) VALUES ${rows
          .map(() => "(?, ?, ?)")
          .join(", ")}
         ON CONFLICT (charger_id, recorded_at) DO UPDATE SET price = excluded.price`
      )
      .bind(...rows.flatMap(([id, price]) => [id, hour, price])),
    db
      .prepare(
        `INSERT INTO charger_price_latest (charger_id, source, price, recorded_at) VALUES ${rows
          .map(() => "(?, ?, ?, ?)")
          .join(", ")}
         ON CONFLICT (charger_id) DO UPDATE SET
           price = excluded.price, recorded_at = excluded.recorded_at`
      )
      .bind(...rows.flatMap(([id, price]) => [id, source, price, hour])),
  ]);
  statements.push(
    db
      .prepare(
        `INSERT INTO charger_price_runs (source, recorded_at) VALUES (?, ?)
         ON CONFLICT (source) DO UPDATE SET recorded_at = excluded.recorded_at`
      )
      .bind(source, hour)
  );
  await runBatches(db, statements);
  return changes.length;
};

// Drops changes older than RETENTION_DAYS, but never a charger's latest:
// it's still its price.
const cleanUpPrices = (db, now = Date.now()) =>
  db
    .prepare(
      `DELETE FROM charger_prices WHERE recorded_at < ? AND recorded_at < (
         SELECT recorded_at FROM charger_price_latest l
         WHERE l.charger_id = charger_prices.charger_id)`
    )
    .bind(now - RETENTION_DAYS * DAY_MS)
    .run();

// True for the */5 cron's first run of an hour.
const isHourStart = (scheduledTime) =>
  scheduledTime !== undefined && new Date(scheduledTime).getUTCMinutes() < 5;

// Gathers EIPA's prices at the start of each hour, from the live statuses'
// download.
const gatherEipaPrices = async (env, data, pointPools, scheduledTime) => {
  if (!isHourStart(scheduledTime)) {
    return;
  }
  const hour = hourOf(scheduledTime);
  const changes = await recordPrices(env.DB, "eipa", eipaPrices(data, pointPools), hour);
  console.log(`Prices: eipa ${changes} changes`);
  if (new Date(hour).getUTCHours() === CLEANUP_HOUR) {
    await cleanUpPrices(env.DB, hour);
  }
};

// One price (or null) per hour from `from` to `to`, both included: the
// changes in between, starting from the one before.
const hourlyPrices = (changes, before, from, to) => {
  const hours = [];
  let price = before?.price ?? null;
  let next = 0;
  for (let hour = from; hour <= to; hour += HOUR_MS) {
    while (next < changes.length && changes[next].recorded_at <= hour) {
      price = changes[next].price;
      next++;
    }
    hours.push(price);
  }
  return hours;
};

const localTime = (timeZone) => {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "numeric",
    weekday: "short",
  });
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (time) => {
    const parts = Object.fromEntries(
      format.formatToParts(new Date(time)).map(({ type, value }) => [type, value])
    );
    return { hour: Number(parts.hour) % 24, weekday: days.indexOf(parts.weekday) };
  };
};

const round = (value) => (value === null ? null : Math.round(value * 100) / 100);

const mean = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const levelOf = (value, usual) => {
  if (value === null || !usual) {
    return null;
  }
  if (value >= usual * (1 + DEVIATION)) {
    return "higher";
  }
  return value <= usual * (1 - DEVIATION) ? "lower" : "usual";
};

// The hours of the day (0-23) of a level as ranges { from, to } (`to`
// excluded), joined across midnight.
const hourRanges = (levels, level) => {
  const ranges = [];
  for (let hour = 0; hour < 24; hour++) {
    if (levels[hour] !== level) {
      continue;
    }
    const last = ranges.at(-1);
    if (last && last.to === hour) {
      last.to = hour + 1;
    } else {
      ranges.push({ from: hour, to: hour + 1 });
    }
  }
  if (ranges.length > 1 && ranges[0].from === 0 && ranges.at(-1).to === 24) {
    ranges[0].from = ranges.pop().from;
  }
  return ranges;
};

// The pattern of hourly prices starting at `from`: the usual (average)
// price, the lowest and highest, the latest, and, with enough data, the
// average of each hour of the day and day of the week (0 is Monday) in the
// source's time zone, and which are much cheaper or pricier than usual.
const pricePattern = (hours, from, timeZone) => {
  const priced = hours
    .map((price, index) => ({ price, time: from + index * HOUR_MS }))
    .filter(({ price }) => price !== null);
  if (!priced.length) {
    return null;
  }
  const prices = priced.map(({ price }) => price);
  const usual = mean(prices);
  const current = hours.at(-1) ?? null;
  const pattern = {
    usual: round(usual),
    min: Math.min(...prices),
    max: Math.max(...prices),
    current,
    currentLevel: levelOf(current, usual),
    pricedHours: priced.length,
    byHour: null,
    byWeekday: null,
    cheapHours: [],
    expensiveHours: [],
    cheapDays: [],
    expensiveDays: [],
  };
  if (priced.length < MIN_PATTERN_HOURS) {
    return pattern;
  }
  const local = localTime(timeZone);
  const byHour = Array.from({ length: 24 }, () => []);
  const byWeekday = Array.from({ length: 7 }, () => []);
  for (const { price, time } of priced) {
    const { hour, weekday } = local(time);
    byHour[hour].push(price);
    byWeekday[weekday].push(price);
  }
  const hourAverages = byHour.map((values) => round(mean(values)));
  const dayAverages = byWeekday.map((values) => round(mean(values)));
  const hourLevels = hourAverages.map((value) => levelOf(value, usual));
  const dayLevels = dayAverages.map((value) => levelOf(value, usual));
  const daysOf = (level) => dayLevels.flatMap((dayLevel, day) => (dayLevel === level ? [day] : []));
  return {
    ...pattern,
    byHour: hourAverages,
    byWeekday: dayAverages,
    cheapHours: hourRanges(hourLevels, "lower"),
    expensiveHours: hourRanges(hourLevels, "higher"),
    cheapDays: daysOf("lower"),
    expensiveDays: daysOf("higher"),
  };
};

// The charger's changes from `from` on, and the one before.
const changesOf = async (db, chargerId, from) => {
  const [{ results: changes }, before] = await Promise.all([
    db
      .prepare(
        `SELECT recorded_at, price FROM charger_prices
         WHERE charger_id = ? AND recorded_at >= ? ORDER BY recorded_at`
      )
      .bind(chargerId, from)
      .all(),
    db
      .prepare(
        `SELECT recorded_at, price FROM charger_prices
         WHERE charger_id = ? AND recorded_at < ? ORDER BY recorded_at DESC LIMIT 1`
      )
      .bind(chargerId, from)
      .first(),
  ]);
  return { changes, before };
};

// The charger's last PATTERN_DAYS, hourly, with its pattern and its
// changes; null without any.
const priceHistory = async (db, chargerId, now = Date.now()) => {
  const source = PRICE_SOURCES[chargerId.split(":")[0]];
  if (!source) {
    return null;
  }
  const run = await db
    .prepare("SELECT recorded_at FROM charger_price_runs WHERE source = ?")
    .bind(chargerId.split(":")[0])
    .first();
  if (!run) {
    return null;
  }
  const to = Math.min(run.recorded_at, hourOf(now));
  const from = to - (PATTERN_DAYS * 24 - 1) * HOUR_MS;
  const { changes, before } = await changesOf(db, chargerId, from);
  if (!changes.length && !before) {
    return null;
  }
  // Before its first change, nothing is known.
  const start = before ? from : Math.max(from, changes[0].recorded_at);
  const hours = hourlyPrices(changes, before, start, to);
  const pattern = pricePattern(hours, start, source.timeZone);
  if (!pattern) {
    return null;
  }
  return {
    id: chargerId,
    unit: source.unit,
    timeZone: source.timeZone,
    from: start,
    to,
    hours,
    changes: [...(before ? [before] : []), ...changes].map((change) => ({
      recordedAt: change.recorded_at,
      price: change.price,
    })),
    ...pattern,
  };
};

// The history of the first of the IDs that has one.
const pricesResponse = async (request, env) => {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => PRICE_SOURCES[id.split(":")[0]])
    .slice(0, MAX_IDS);
  for (const id of ids) {
    const history = await priceHistory(env.DB, id);
    if (history) {
      return json({ history });
    }
  }
  return json({ history: null });
};

// The admin page's data: how many chargers have a price, when prices were
// last gathered, how many changed in the last day, the latest changes, and
// the `charger` asked for's history.
const listAdminPrices = async (db, chargerId = null, now = Date.now()) => {
  const [tracked, runs, changedToday, { results: recent }, charger] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) AS count FROM charger_price_latest WHERE price IS NOT NULL")
      .first(),
    db.prepare("SELECT source, recorded_at FROM charger_price_runs ORDER BY source").all(),
    db
      .prepare("SELECT COUNT(*) AS count FROM charger_prices WHERE recorded_at >= ?")
      .bind(now - DAY_MS)
      .first(),
    db
      .prepare(
        `SELECT p.charger_id, p.recorded_at, p.price, c.name, c.operator,
           (SELECT price FROM charger_prices b WHERE b.charger_id = p.charger_id
            AND b.recorded_at < p.recorded_at ORDER BY b.recorded_at DESC LIMIT 1) AS previous
         FROM charger_prices p
         LEFT JOIN chargers c
           ON c.source = substr(p.charger_id, 1, instr(p.charger_id, ':') - 1)
           AND c.source_id = substr(p.charger_id, instr(p.charger_id, ':') + 1)
         ORDER BY p.recorded_at DESC, p.charger_id LIMIT ?`
      )
      .bind(MAX_RECENT_CHANGES)
      .all(),
    chargerId ? priceHistory(db, chargerId, now) : null,
  ]);
  return {
    tracked: tracked?.count ?? 0,
    changedToday: changedToday?.count ?? 0,
    runs: runs.results.map((row) => ({
      source: row.source,
      unit: PRICE_SOURCES[row.source]?.unit ?? null,
      recordedAt: row.recorded_at,
    })),
    recent: recent.map((row) => ({
      chargerId: row.charger_id,
      chargerName: row.name || row.operator || null,
      unit: PRICE_SOURCES[row.charger_id.split(":")[0]]?.unit ?? null,
      recordedAt: row.recorded_at,
      price: row.price,
      previous: row.previous,
    })),
    chargerId,
    charger,
  };
};

const chargerParam = (url) => {
  const id = url.searchParams.get("charger")?.trim();
  return id && /^[^:]+:.+$/.test(id) && id.length <= 200 ? id : null;
};

const routes = [
  {
    name: "prices",
    limiter: "STATUS_LIMITER",
    signedIn: true,
    matches: (request, url) => request.method === "GET" && url.pathname === PRICES_PATH,
    handle: ({ request, env }) => pricesResponse(request, env),
  },
  {
    name: "admin-prices",
    limiter: "ADMIN_LIMITER",
    signedIn: true,
    admin: true,
    matches: (request, url) => request.method === "GET" && url.pathname === ADMIN_PRICES_PATH,
    handle: async ({ env, url }) =>
      json(await listAdminPrices(env.DB, chargerParam(url)), "private, no-store"),
  },
];

export {
  PRICES_PATH,
  chargerParam,
  cleanUpPrices,
  eipaPrices,
  gatherEipaPrices,
  hourRanges,
  hourlyPrices,
  isHourStart,
  listAdminPrices,
  priceHistory,
  pricePattern,
  pricesResponse,
  recordPrices,
  routes,
};
