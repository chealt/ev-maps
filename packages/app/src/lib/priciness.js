// How pricey a charger is compared with others: its per-kWh price read from
// the free-text cost the sources give (e.g. "0,39 €/kWh", "£0.79/kWh",
// "bruttó 80 Ft/kWh", "PLN 1.89/kWh", "45c/kWh"), and where that sits among
// the other chargers' prices in the same currency.

// A price per kWh: the number, its unit around it ("0,25€/kWh", "€0.32/kWh",
// "99,- Ft/kWh") and how it's "per kWh" ("/", "per", German "pro", Polish
// "za"). After the number the unit is any short symbol or code; before it,
// only a currency ("PLN 1.89/kWh"), not any word ("AC 15cnt/kWh"). Anything
// else between the number and "/kWh" (another number, "+", ";") isn't this
// price's.
const PRICE =
  /([£$€]|\b(?:EUR|GBP|PLN|HUF|CZK|RON|CHF|SEK|NOK|DKK|USD|AUD|CAD|NZD)\b)?\s*(\d+(?:[.,]\d+)?)(?:,-)?\s*([^\d\s/+;,()]{1,5}?\.?)?\s*(?:\/|\bper\b|\bpro\b|\bza\b)\s*(?:1\s*)?kwh/i;

// Units for hundredths of the currency: "45c/kWh", "35p/kWh", "41ct/kWh".
const MINOR_UNITS = new Set(["c", "ct", "cts", "cnt", "cent", "cents", "¢", "p", "pence"]);

// The same currencies, however they're written.
const CURRENCIES = {
  "€": "EUR",
  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  "£": "GBP",
  gbp: "GBP",
  p: "GBP",
  pence: "GBP",
  ft: "HUF",
  huf: "HUF",
  zł: "PLN",
  zl: "PLN",
  pln: "PLN",
  kč: "CZK",
  czk: "CZK",
  ron: "RON",
  lei: "RON",
  chf: "CHF",
  sek: "SEK",
  nok: "NOK",
  dkk: "DKK",
  usd: "USD",
};

const currencyOf = (unit) => {
  const key = unit?.toLowerCase().replace(/\.$/, "");
  if (!key) {
    return null;
  }
  // "c", "ct", "cent" and "¢" are cents of whatever the dollar or euro is.
  if (MINOR_UNITS.has(key) && !CURRENCIES[key]) {
    return null;
  }
  return CURRENCIES[key] ?? key.toUpperCase();
};

// The per-kWh price in a cost text, { price, currency }, or null without
// one. `currency` is null when the text doesn't say (e.g. "0.45/kWh").
const pricePerKwh = (usageCost) => {
  const match = PRICE.exec(usageCost ?? "");
  if (!match) {
    return null;
  }
  const [, before, number, after] = match;
  let price = Number(number.replace(",", "."));
  if (!(price > 0)) {
    return null;
  }
  const unit = after?.toLowerCase().replace(/\.$/, "");
  // Hundredths, unless a currency before the number says otherwise
  // ("£0.30p per kWh" is £0.30).
  if (MINOR_UNITS.has(unit) && !before) {
    price /= 100;
  }
  return { price, currency: currencyOf(before) ?? currencyOf(after) };
};

// How many of the sorted prices are below `price` (or, `orEqual`, at most).
const countBelow = (sorted, price, orEqual = false) => {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sorted[middle] < price || (orEqual && sorted[middle] === price)) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

// Where each charger's price sits among the given chargers' (e.g. the
// map's or the route's), as a function of a charger: 1–3 by thirds
// ("level"), and the shares of the comparable prices that are cheaper and
// pricier ("cheaper", "pricier"; equal ones are neither); null
// when it has no per-kWh price or nothing to compare it with. Prices in
// different currencies aren't compared; one that doesn't say its currency
// is taken to be in the local one. The chargers are read once, so asking
// about every one of them stays quick.
const pricinessAmong = (chargers) => {
  const all = [];
  const unsaid = [];
  const byCurrency = new Map();
  for (const { usageCost } of chargers) {
    const parsed = pricePerKwh(usageCost);
    if (!parsed) {
      continue;
    }
    all.push(parsed.price);
    if (parsed.currency == null) {
      unsaid.push(parsed.price);
    } else {
      if (!byCurrency.has(parsed.currency)) {
        byCurrency.set(parsed.currency, []);
      }
      byCurrency.get(parsed.currency).push(parsed.price);
    }
  }
  for (const prices of [all, unsaid, ...byCurrency.values()]) {
    prices.sort((a, b) => a - b);
  }
  return (charger) => {
    const own = pricePerKwh(charger.usageCost);
    if (!own) {
      return null;
    }
    const groups = own.currency == null ? [all] : [byCurrency.get(own.currency) ?? [], unsaid];
    const total = groups.reduce((sum, prices) => sum + prices.length, 0);
    if (total < 2) {
      return null;
    }
    const below = groups.reduce((sum, prices) => sum + countBelow(prices, own.price), 0);
    const atMost = groups.reduce((sum, prices) => sum + countBelow(prices, own.price, true), 0);
    const cheaper = below / total;
    return {
      level: Math.min(3, Math.floor(cheaper * 3) + 1),
      cheaper,
      pricier: (total - atMost) / total,
    };
  };
};

// One charger's priciness among the given ones (see pricinessAmong).
const priciness = (charger, chargers) => pricinessAmong(chargers)(charger);

export { priciness, pricinessAmong, pricePerKwh };
