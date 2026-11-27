// What <ev-table> (table.js) sorts by: a cell's `data-sort`, or its text; a
// number when it starts with one (with thousands separators, or a unit
// after it: "1,234", "12 ms"). Numbers sort as numbers, text by the
// language's order with its digits as numbers.

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const sortValue = (cell) => {
  const raw = (cell?.dataset?.sort ?? cell?.textContent ?? "").trim();
  if (!/^[-+]?\d/.test(raw)) {
    return raw;
  }
  const number = Number.parseFloat(raw.replace(/[\s,\u00a0\u202f]/g, ""));
  return Number.isFinite(number) ? number : raw;
};

const compare = (a, b) =>
  typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));

export { compare, sortValue };
