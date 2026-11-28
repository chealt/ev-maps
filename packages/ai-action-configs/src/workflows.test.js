import { describe, expect, test } from "bun:test";
import {
  FINDINGS_INSTRUCTION,
  FIX_FINDINGS_INSTRUCTION,
  REPORT_INSTRUCTION,
  configErrors,
  cronOf,
  workflowOf,
} from "./workflows.js";

const config = {
  cron: "daily",
  prompt: 'Upgrade the "outdated" packages',
  model: "claude-opus-5-5",
};

describe("cronOf", () => {
  test("names a schedule, at a minute of its own", () => {
    expect(cronOf("upgrade-packages", "daily")).toMatch(/^\d{1,2} 6 \* \* \*$/);
    expect(cronOf("upgrade-packages", "hourly")).toMatch(/^\d{1,2} \* \* \* \*$/);
    expect(cronOf("upgrade-packages", "weekly")).toMatch(/^\d{1,2} 6 \* \* 1$/);
    expect(cronOf("a", "daily")).not.toBe(cronOf("b", "daily"));
    expect(cronOf("x", "15 3 * * 2")).toBe("15 3 * * 2");
  });
});

describe("configErrors", () => {
  test("accepts a complete config", () => {
    expect(configErrors("upgrade-packages", config)).toEqual([]);
  });

  test("says what's missing or wrong", () => {
    expect(configErrors("Bad Name", { ...config, cron: "sometimes", model: "" })).toEqual([
      "Bad Name: the file name must be lowercase letters, digits and dashes",
      "Bad Name: cron must be hourly, daily, weekly or a cron expression",
      "Bad Name: model is required",
    ]);
  });

  test("allows models through Radius only", () => {
    expect(configErrors("upgrade-packages", { ...config, provider: "radius" })).toEqual([]);
    expect(configErrors("upgrade-packages", { ...config, provider: "anthropic" })).toEqual([
      'upgrade-packages: models are used through Radius only; remove "provider"',
    ]);
  });
});

describe("configErrors of issues", () => {
  test("accepts labels and a priority, or neither", () => {
    const issues = { labels: ["security"], priority: "High" };
    expect(configErrors("security-audit", { ...config, issues })).toEqual([]);
    expect(configErrors("security-audit", { ...config, issues: {} })).toEqual([]);
  });

  test("says what's wrong", () => {
    expect(
      configErrors("security-audit", { ...config, issues: { labels: "security", priority: "Top" } })
    ).toEqual([
      "security-audit: issues.labels must be a list of label names",
      "security-audit: issues.priority must be one of Urgent, High, Medium, Low",
    ]);
  });
});

describe("workflowOf with issues", () => {
  const workflow = workflowOf("security-audit", {
    ...config,
    issues: { labels: ["security"], priority: "High" },
  });

  test("files the findings as issues, without a pull request", () => {
    expect(workflow).toContain("  contents: read\n  issues: write\n");
    expect(workflow).not.toContain("create-pull-request");
    expect(workflow).toContain(`FINDINGS_INSTRUCTION: ${JSON.stringify(FINDINGS_INSTRUCTION)}`);
    expect(workflow).toContain("FINDINGS: ${{ runner.temp }}/findings.json");
    expect(workflow).toContain(
      'bun packages/ai-action-configs/scripts/file-issues.js "$RUNNER_TEMP/findings.json"'
    );
    expect(workflow).toContain('LABELS: "security"');
    expect(workflow).toContain('PRIORITY: "High"');
  });
});

describe("configErrors of fixes", () => {
  test("accepts labels, a prefix and a limit, all optional", () => {
    const fixes = { labels: ["security"], prefix: "Security", limit: 3 };
    expect(configErrors("security-audit", { ...config, fixes })).toEqual([]);
    expect(configErrors("security-audit", { ...config, fixes: {} })).toEqual([]);
  });

  test("rejects bad ones, and fixes with issues", () => {
    expect(
      configErrors("security-audit", {
        ...config,
        issues: {},
        fixes: { labels: "security", prefix: " ", limit: 0 },
      })
    ).toEqual([
      "security-audit: use issues or fixes, not both",
      "security-audit: fixes.labels must be a list of label names",
      "security-audit: fixes.prefix must be a pull request title prefix",
      "security-audit: fixes.limit must be a positive whole number",
    ]);
  });
});

describe("workflowOf with fixes", () => {
  const workflow = workflowOf("security-audit", {
    ...config,
    fixes: { labels: ["security"], prefix: "Security", limit: 2 },
  });

  test("fixes the findings in pull requests of their own, without issues", () => {
    expect(workflow).toContain("  contents: write\n  pull-requests: write\n");
    expect(workflow).not.toContain("issues: write");
    expect(workflow).not.toContain("create-pull-request");
    expect(workflow).toContain(`FINDINGS_INSTRUCTION: ${JSON.stringify(FIX_FINDINGS_INSTRUCTION)}`);
    expect(workflow).toContain(
      'bun packages/ai-action-configs/scripts/fix-findings.js "$RUNNER_TEMP/findings.json"'
    );
    expect(workflow).toContain('PREFIX: "Security"');
    expect(workflow).toContain('LIMIT: "2"');
    expect(workflow).toContain('LABELS: "security"');
    expect(workflow).toContain('MODEL: "claude-opus-5-5"');
  });

  test("pushes with the AI actions token, so the checks run", () => {
    expect(workflow).toContain(
      "uses: actions/checkout@v7\n        with:\n          token: ${{ secrets.AI_ACTIONS_TOKEN || github.token }}"
    );
  });
});

describe("workflowOf", () => {
  const workflow = workflowOf("upgrade-packages", config);

  test("runs pi with the prompt and model on the schedule", () => {
    expect(workflow).toContain(`- cron: "${cronOf("upgrade-packages", "daily")}"`);
    expect(workflow).toContain('--provider radius --model "claude-opus-5-5"');
    // The prompt, quoted for YAML, reaches pi through an environment variable.
    expect(workflow).toContain('PROMPT: "Upgrade the \\"outdated\\" packages"');
    // Through Radius, with its key, and no other provider's.
    expect(workflow).toContain("RADIUS_API_KEY: ${{ secrets.RADIUS_API_KEY }}");
    expect(workflow).not.toMatch(/ANTHROPIC|OPENAI|GEMINI/);
  });

  test("opens a pull request on a branch of its own", () => {
    expect(workflow).toContain("  contents: write\n  pull-requests: write\n");
    expect(workflow).toContain("uses: peter-evans/create-pull-request@v8");
    expect(workflow).toContain("branch: ai/upgrade-packages");
  });

  test("describes the pull request with pi's report of what it did", () => {
    // pi is asked for the report, and its output kept, with pipefail.
    expect(workflow).toContain(`REPORT_INSTRUCTION: ${JSON.stringify(REPORT_INSTRUCTION)}`);
    expect(workflow).toContain(`"$PROMPT"$'\\n\\n'"$REPORT_INSTRUCTION"`);
    expect(workflow).toContain('| tee "$RUNNER_TEMP/pi-report.md"');
    expect(workflow).toContain("shell: bash");
    // The description: the header, the prompt quoted, then the report.
    expect(workflow).toContain('cat "$RUNNER_TEMP/pi-report.md"');
    expect(workflow).toContain("body-path: ${{ runner.temp }}/pull-request-body.md");
    expect(workflow).not.toContain("body: ");
  });

  test("uses the repository's Node version", () => {
    expect(workflow).toContain("node-version-file: package.json");
  });

  test("says it's generated, from which config", () => {
    expect(
      workflow.startsWith(
        "# Generated by packages/ai-action-configs from configs/upgrade-packages.json."
      )
    ).toBe(true);
  });
});
