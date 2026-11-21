// Parses CSV (RFC 4180: quoted fields may hold commas, quotes and line breaks)
// from a stream of text, one row at a time, so large files never have to fit
// in memory: France's charging point file is over 100 MB.

// Yields each row as an object keyed by the header row's names. A function
// expression, as generators can't be arrow functions.
const csvRows = async function* (textStream) {
  let header = null;
  let row = [];
  let field = "";
  let quoted = false;
  // A quote inside a quoted field: the end of the field, or the first of "".
  let quoteSeen = false;

  const endRow = () => {
    row.push(field);
    field = "";
    const done = row;
    row = [];
    if (!header) {
      header = done.map((name) => name.replace(/^\uFEFF/, ""));
      return null;
    }
    return done.length === 1 && done[0] === ""
      ? null
      : Object.fromEntries(header.map((name, index) => [name, done[index] ?? ""]));
  };

  for await (const chunk of textStream) {
    const rows = [];
    for (let index = 0; index < chunk.length; index++) {
      const char = chunk[index];
      if (quoted) {
        if (quoteSeen) {
          quoteSeen = false;
          if (char === '"') {
            field += '"';
            continue;
          }
          quoted = false;
        } else if (char === '"') {
          quoteSeen = true;
          continue;
        } else {
          field += char;
          continue;
        }
      }
      if (char === '"' && field === "") {
        quoted = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        const done = endRow();
        if (done) {
          rows.push(done);
        }
      } else if (char !== "\r") {
        field += char;
      }
    }
    yield* rows;
  }
  if (quoteSeen) {
    quoted = false;
  }
  if (field !== "" || row.length) {
    const done = endRow();
    if (done) {
      yield done;
    }
  }
};

export { csvRows };
