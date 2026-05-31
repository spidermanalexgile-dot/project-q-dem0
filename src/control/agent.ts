/**
 * Claude-brained concierge orchestrator (client side).
 *
 * Runs a tool-use loop against the /api/agent proxy (which holds ANTHROPIC_API_KEY
 * server-side). Claude reads the request, calls the deterministic tools in
 * agent-tools.ts — which run the real calc engine against the live store — and
 * phrases the answer. The model never does arithmetic; every figure it speaks
 * came back from a tool. If the proxy isn't configured (no key / offline), this
 * returns null so the caller falls back to the deterministic analyst.
 */

import { AGENT_TOOLS, runTool, stateSummary, type ToolDeps } from "./agent-tools";

export type AgentReply = { answer: string; appliedAny: boolean } | null;

// Session cache: null = untested, true = proxy live, false = unavailable (stop trying).
let brainAvailable: boolean | null = null;

export function brainStatus(): boolean | null {
  return brainAvailable;
}

/** One-shot health probe so the UI can show "premium brain" without a full call. */
export async function probeBrain(): Promise<boolean> {
  if (brainAvailable !== null) return brainAvailable;
  try {
    const r = await fetch("/api/agent", { method: "GET" });
    if (!r.ok) { brainAvailable = false; return false; }
    const j = await r.json();
    brainAvailable = !!j.ok;
    return brainAvailable;
  } catch {
    brainAvailable = false;
    return false;
  }
}

function systemPrompt(): string {
  return [
    "You are the Project Q concierge — a calm, sharp female advisor embedded in a city's dynamic-pricing Authority Control dashboard for tourism demand.",
    "You speak the replies aloud, so keep them to one to three short sentences, conversational, no markdown, no bullet symbols.",
    "",
    "CRITICAL: never compute numbers yourself. Every figure (fees, revenue, crowd %, lever values) MUST come from a tool result. If you need a number, call the relevant tool.",
    "When the user issues a command (set/raise/lower/change/show/switch), call the matching set_* tool to actually apply it, then confirm what changed.",
    "When the user asks an analytical question, call the analysis tools (suggest_lever_settings, goal_seek_revenue, cheapest_lever_for_revenue, explain_demand, get_revenue, whatif_date) and explain the result plainly.",
    "If they ask you to suggest or tune lever settings, call suggest_lever_settings; pass apply:true when they want it set up, otherwise just report the recommendation and offer to apply it.",
    "Round money to whole euros and use 'k'/'M' for large figures when speaking. If a tool returns an error, say so briefly and suggest a fix.",
    "",
    "Live dashboard state right now:",
    stateSummary(),
  ].join("\n");
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: string; [k: string]: unknown };

/**
 * Ask the Claude brain. Returns null (caller should fall back) when the proxy is
 * unavailable; otherwise returns the spoken answer and whether anything was applied.
 */
export async function agentAsk(userText: string, deps: ToolDeps = {}): Promise<AgentReply> {
  if (brainAvailable === false) return null;

  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: userText },
  ];
  let appliedAny = false;

  try {
    for (let turn = 0; turn < 5; turn++) {
      const resp = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: systemPrompt(), tools: AGENT_TOOLS, messages }),
      });
      if (!resp.ok) {
        // First failure for the session → disable and let the deterministic path take over.
        if (brainAvailable === null) brainAvailable = false;
        return null;
      }
      brainAvailable = true;
      const data = (await resp.json()) as { content?: ContentBlock[]; stop_reason?: string };
      const content = data.content ?? [];
      messages.push({ role: "assistant", content });

      const toolUses = content.filter((c): c is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => c.type === "tool_use");
      if (data.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join(" ")
          .trim();
        return { answer: text || "Done.", appliedAny };
      }

      const toolResults = toolUses.map((tu) => {
        const { result, applied } = runTool(tu.name, tu.input || {}, deps);
        if (applied) appliedAny = true;
        return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) };
      });
      messages.push({ role: "user", content: toolResults });
    }
    // Ran out of tool turns — return whatever the last text was, or a soft note.
    return { answer: "I've applied what I could — ask me to confirm the numbers.", appliedAny };
  } catch {
    if (brainAvailable === null) brainAvailable = false;
    return null;
  }
}
