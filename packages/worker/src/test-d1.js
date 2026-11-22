// A D1-shaped database for tests: bun:sqlite in memory, with the given
// migration files run, answering prepare().bind().all()/first()/run().
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";

const testD1 = (...migrationPaths) => {
  const sqlite = new Database(":memory:");
  for (const path of migrationPaths) {
    sqlite.exec(readFileSync(new URL(path, import.meta.url), "utf8"));
  }
  const statement = (sql, values = []) => ({
    bind: (...bound) => statement(sql, bound),
    all: async () => ({ results: sqlite.query(sql).all(...values) }),
    first: async () => sqlite.query(sql).get(...values) ?? null,
    run: async () => sqlite.query(sql).run(...values),
  });
  return { prepare: (sql) => statement(sql), sqlite };
};

export { testD1 };
