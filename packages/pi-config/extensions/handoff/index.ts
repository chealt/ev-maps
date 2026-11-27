/**
 * Handoff: starts a fresh session for the next task, so a long session's
 * history isn't sent (and paid for) with every request.
 *
 * - The `handoff` tool: the agent calls it when a task is done and the next
 *   one is unrelated (another issue or pull request). It ends the run; once
 *   the agent is idle, the extension asks to start a new session (one key)
 *   and sends the new session the agent's brief as its first prompt.
 * - `/handoff [brief]`: the same by hand. Without a brief it starts empty.
 *
 * Tools can't switch sessions (only commands can, while the agent is idle),
 * so the tool records the brief and agent_settled runs the command, as in
 * Pi's reload-runtime example.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  let pendingBrief: string | undefined;

  pi.registerCommand("handoff", {
    description:
      "Start a new session for the next task, with an optional brief as its first prompt",
    handler: async (args, ctx) => {
      const brief = (args ?? "").trim() || pendingBrief || "";
      pendingBrief = undefined;
      await ctx.waitForIdle();
      if (ctx.hasUI) {
        const ok = await ctx.ui.confirm(
          "Start a new session?",
          brief ? `Its first prompt:\n\n${brief}` : "It starts empty."
        );
        if (!ok) {
          return;
        }
      }
      const parentSession = ctx.sessionManager.getSessionFile();
      await ctx.newSession({
        parentSession,
        withSession: async (next) => {
          if (brief) {
            await next.sendUserMessage(brief);
          }
        },
      });
    },
  });

  pi.registerTool({
    name: "handoff",
    label: "Hand off",
    description:
      "Start a fresh session for the next, unrelated task, with a brief as its first prompt. Ends this run.",
    promptSnippet: "Start a fresh session for the next unrelated task (saves context and cost)",
    promptGuidelines: [
      "Use handoff when the current task (an issue or pull request) is done and pushed, and the next is unrelated: the new session reads AGENTS.md and the repository's docs, so give it only what they don't say.",
      "Write the handoff brief as the user's next prompt: the task (issue or PR number, branch), what's decided, and what's left; not this session's history.",
      "Don't use handoff in the middle of a task, or when the user is still discussing the current one.",
    ],
    parameters: Type.Object({
      brief: Type.String({ description: "The new session's first prompt" }),
    }),
    async execute(_id, params) {
      pendingBrief = params.brief;
      return {
        content: [
          { type: "text", text: "Handoff requested: a new session starts after this response." },
        ],
        details: {},
        terminate: true,
      };
    },
  });

  pi.on("agent_settled", () => {
    if (pendingBrief === undefined) {
      return;
    }
    pi.sendUserMessage("/handoff", { expandPromptTemplates: true });
  });
}
