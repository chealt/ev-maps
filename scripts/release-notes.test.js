import { describe, expect, test } from "bun:test";
import { notes, parse } from "./release-notes.js";

describe("parse", () => {
  test("reads a Conventional Commit title", () => {
    expect(parse("fix(app): let the pages scroll (#95)")).toEqual({
      type: "fix",
      scope: "app",
      description: "let the pages scroll (#95)",
    });
  });

  test("files unknown kinds and plain titles under other changes", () => {
    expect(parse("build: bump wrangler").type).toBe("chore");
    expect(parse("Merge branch 'main'")).toEqual({
      type: "chore",
      scope: undefined,
      description: "Merge branch 'main'",
    });
  });
});

describe("notes", () => {
  test("groups the changes by kind, features first", () => {
    expect(
      notes([
        "fix(app): let the pages scroll (#95)",
        "feat: save chargers as favorites (#67)",
        "feat(worker): France's register (#48)",
      ])
    ).toBe(
      [
        "## New features",
        "",
        "- Save chargers as favorites (#67)",
        "- **worker:** France's register (#48)",
        "",
        "## Bug fixes",
        "",
        "- **app:** Let the pages scroll (#95)",
        "",
      ].join("\n")
    );
  });

  test("says when nothing changed", () => {
    expect(notes([])).toBe("No changes since the last release.\n");
  });
});
