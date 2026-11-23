/**
 * Model fallback: a virtual model ("fallback/auto" by default) that sends
 * every request to the first model of a chain, and moves down the chain when
 * that model hits a rate or usage limit.
 *
 * Config: this package's model-fallback.json (the repository's chain), which
 * ~/.pi/agent/model-fallback.json overrides field by field, e.g. on a machine
 * without credentials for one of the providers:
 *   {
 *     "provider": "fallback", "id": "auto", "name": "…",
 *     "chain": [{ "provider": "anthropic", "model": "claude-opus-5-5" }, …],
 *     "cooldownMinutes": 30
 *   }
 *
 * - Rate limits (429, "rate limit", overloaded…) are retried by Pi: the retry
 *   goes to the next model of the chain right away.
 * - Usage limits (quota, billing, plan limit) end the turn without a retry:
 *   the extension marks the model as limited and continues the turn on the
 *   next model.
 * - A limited model is skipped for `cooldownMinutes`, then tried again at the
 *   next prompt. Tool follow-ups stay on the model that handled the turn, to
 *   keep prompt caches.
 *
 * - When every model of the chain is limited, it says so and stops, instead
 *   of handing the turn from one limited model to the next.
 *
 * /fallback shows the chain and which models are cooling down;
 * /fallback reset clears the cooldowns.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ChainEntry = { provider: string; model: string };
type Config = {
  provider: string;
  id: string;
  name: string;
  chain: ChainEntry[];
  cooldownMinutes: number;
};

const PACKAGE_CONFIG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "model-fallback.json"
);
const CONFIG_PATH = join(homedir(), ".pi", "agent", "model-fallback.json");
const DEFAULTS: Config = {
  provider: "fallback",
  id: "auto",
  name: "Fallback",
  chain: [],
  cooldownMinutes: 30,
};

// Rate limits, overload and usage/quota limits: reasons to move on.
const LIMIT_ERROR =
  /rate.?limit|too many requests|(?<![a-z0-9])429(?![a-z0-9])|overloaded|usage.?limit|quota|billing|out of budget|insufficient_quota|"code"\s*:\s*"?1308(?![0-9])|credit balance/i;

const readJson = (path: string) => {
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`model-fallback: can't read ${path}:`, error);
    return {};
  }
};

// The package's config, then the user's on top of it.
const loadConfig = (): Config => ({
  ...DEFAULTS,
  ...readJson(PACKAGE_CONFIG_PATH),
  ...readJson(CONFIG_PATH),
});

const keyOf = (entry: { provider: string; id?: string; model?: string }) =>
  `${entry.provider}/${entry.id ?? entry.model}`;

export default function (pi: ExtensionAPI) {
  const config = loadConfig();
  // "provider/model" → time its cooldown ends. Kept for this Pi process.
  const limitedUntil = new Map<string, number>();
  // Set when a usage limit ended a turn: continue it on the next model.
  let continueAfterLimit: { from: string; error: string } | null = null;

  const isLimited = (key: string) => (limitedUntil.get(key) ?? 0) > Date.now();
  const markLimited = (key: string) =>
    limitedUntil.set(key, Date.now() + config.cooldownMinutes * 60_000);

  // The first model of the chain that has credentials and isn't cooling
  // down; if all are, the one whose cooldown ends first.
  const pick = (ctx: any) => {
    const available = config.chain
      .map((entry) => ({ entry, model: ctx.modelRegistry.find(entry.provider, entry.model) }))
      .filter(({ model }) => model);
    if (available.length === 0) {
      throw new Error(`model-fallback: none of the chain's models is available (${CONFIG_PATH})`);
    }
    const ready = available.find(({ entry }) => !isLimited(keyOf(entry)));
    if (ready) {
      return ready.model;
    }
    return available.sort(
      (a, b) => (limitedUntil.get(keyOf(a.entry)) ?? 0) - (limitedUntil.get(keyOf(b.entry)) ?? 0)
    )[0].model;
  };

  pi.registerVirtualModel({
    provider: config.provider,
    id: config.id,
    name: config.name,
    thinkingLevels: ["off", "minimal", "low", "medium", "high", "xhigh"],
    contextWindow: 1_000_000,
    route(request, ctx) {
      const thinkingLevel = request.thinkingLevel;
      if (request.reason === "retry" && request.failed) {
        const error = request.failed.message?.errorMessage ?? "";
        if (LIMIT_ERROR.test(error)) {
          markLimited(keyOf(request.failed.model));
          const next = pick(ctx);
          if (keyOf(next) !== keyOf(request.failed.model)) {
            ctx.ui?.notify?.(
              `${keyOf(request.failed.model)} hit a limit; continuing on ${keyOf(next)}`,
              "warning"
            );
          }
          return { model: next, thinkingLevel };
        }
        // Other failures: retry where it failed.
        return { model: request.failed.model, thinkingLevel };
      }
      // Tool follow-ups stay on the model of the turn, unless it's limited.
      if (
        request.reason === "continuation" &&
        request.previous &&
        !isLimited(keyOf(request.previous.model))
      ) {
        return { model: request.previous.model, thinkingLevel };
      }
      return { model: pick(ctx), thinkingLevel };
    },
  });

  // Usage limits aren't retried by Pi: the turn ends with the error. Mark
  // the model and continue on the next one once Pi settles.
  pi.on("message_end", async (event: any) => {
    const message = event.message;
    // A response after it (e.g. Pi's retry on the next model) succeeded:
    // nothing to continue.
    if (message?.role === "assistant" && message.stopReason !== "error") {
      continueAfterLimit = null;
      return;
    }
    if (
      message?.role === "assistant" &&
      message.stopReason === "error" &&
      LIMIT_ERROR.test(message.errorMessage ?? "") &&
      config.chain.some((entry) => keyOf(entry) === `${message.provider}/${message.model}`)
    ) {
      const key = `${message.provider}/${message.model}`;
      markLimited(key);
      continueAfterLimit = { from: key, error: message.errorMessage };
    }
  });

  pi.on("agent_settled", async (event: any, ctx: any) => {
    const limit = continueAfterLimit;
    continueAfterLimit = null;
    if (!limit || event.aborted) {
      return;
    }
    const selected = ctx.model;
    if (selected?.provider !== config.provider || selected?.id !== config.id) {
      return;
    }
    const next = pick(ctx);
    // pick() falls back to a limited model when all are: then there's
    // nowhere to continue, and handing the turn on would only loop.
    if (keyOf(next) === limit.from || isLimited(keyOf(next))) {
      ctx.ui?.notify?.(`Every model of the fallback chain is limited; try again later.`, "error");
      return;
    }
    ctx.ui?.notify?.(`${limit.from} hit a usage limit; continuing on ${keyOf(next)}`, "warning");
    pi.sendMessage(
      {
        customType: "model-fallback",
        content: `The previous model (${limit.from}) hit a usage limit. Continue the task where it stopped.`,
        display: true,
      },
      { triggerTurn: true, deliverAs: "followUp" }
    );
  });

  pi.registerCommand("fallback", {
    description: "Show the fallback chain and cooldowns; /fallback reset clears them",
    handler: async (args: string, ctx: any) => {
      if (args.trim() === "reset") {
        limitedUntil.clear();
        ctx.ui.notify("Fallback cooldowns cleared", "info");
        return;
      }
      const lines = config.chain.map((entry, index) => {
        const until = limitedUntil.get(keyOf(entry)) ?? 0;
        const available = ctx.modelRegistry.find(entry.provider, entry.model)
          ? ""
          : " (no credentials)";
        const cooling =
          until > Date.now()
            ? ` — limited, retried after ${new Date(until).toLocaleTimeString()}`
            : "";
        return `${index + 1}. ${keyOf(entry)}${available}${cooling}`;
      });
      ctx.ui.notify(`${config.provider}/${config.id}:\n${lines.join("\n")}`, "info");
    },
  });
}
