/**
 * Equity advisor orchestrator (client side).
 *
 * Tool-use loop against the /api/agent proxy (ANTHROPIC_API_KEY stays server-
 * side). The system prompt mandates the fairness routine: before recommending
 * or applying any decision the model must call deliberate_decision and narrate
 * the Circle of Viewpoints — who's affected, whose voice is in/missing, who
 * agrees/objects, same-treatment vs needs-based, and the engine's evidence.
 *
 * When the proxy isn't configured this returns null and the UI falls back to
 * a deterministic matcher (fallback.ts) so the demo still works offline.
 */

import { EQUITY_TOOLS, runTool, stateSummary } from "./agent-tools";

export type AdvisorReply = { answer: string; appliedAny: boolean } | null;

let brainAvailable: boolean | null = null;

export function brainStatus(): boolean | null {
  return brainAvailable;
}

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
    "You are the Project Q equity advisor, embedded in the Equity Console — a board where a destination's dynamic sustainability fee (which can soar in a surge or go negative to pay visitors in) is checked against every stakeholder it touches.",
    "Your job is to help the operator make fair AND equitable decisions, and to show their reasoning. Replies are read on screen: 2–6 short sentences, plain text, no markdown headers or bullets.",
    "",
    "CRITICAL: never compute equity numbers yourself. Every score, index, delta, and ranking MUST come from a tool result.",
    "",
    "MANDATED DECISION ROUTINE — before recommending, judging, or applying any decision, call deliberate_decision for it and ground your answer in the result, weaving in (briefly, not as a checklist):",
    "• who is affected, who agrees and who is concerned, and why (the deltas);",
    "• whose voice shaped the rule and whose is still missing;",
    "• whether it treats everyone the same or responds to different needs — and whether THIS moment calls for sameness or needs-based treatment;",
    "• whether it is fair for the whole group (the equity index move) and equitable for the worst-off (their score move);",
    "• the evidence: cite the exact before→after numbers from the tool.",
    "",
    "When the user issues a command (apply/remove/exempt/charge/set scenario), deliberate first if it maps to a decision, then call the matching apply/remove/set tool, and confirm with the tool's returned numbers. The tool's changed:true is the source of truth.",
    "When asked 'who should we help' or 'what next', call suggest_decisions (use target worst_off unless they name a group), then deliberate the top candidate before recommending it.",
    "If a request maps to no catalog decision, say so and name the nearest one — do not invent policies or numbers.",
    "If a voice is missing from the room (voicesMissing), say so plainly — surfacing the missing voice is part of the job.",
    "",
    "Live board right now:",
    stateSummary(),
  ].join("\n");
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: string; [k: string]: unknown };

/** Ask the advisor. Null = proxy unavailable (caller should use the fallback). */
export async function advisorAsk(userText: string): Promise<AdvisorReply> {
  if (brainAvailable === false) return null;

  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: userText },
  ];
  let appliedAny = false;

  try {
    for (let turn = 0; turn < 6; turn++) {
      const resp = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: systemPrompt(), tools: EQUITY_TOOLS, messages }),
      });
      if (!resp.ok) {
        if (brainAvailable === null) brainAvailable = false;
        return null;
      }
      brainAvailable = true;
      const data = (await resp.json()) as { content?: ContentBlock[]; stop_reason?: string };
      const content = data.content ?? [];
      messages.push({ role: "assistant", content });

      const toolUses = content.filter(
        (c): c is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => c.type === "tool_use",
      );
      if (data.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join(" ")
          .trim();
        return { answer: text || "Done.", appliedAny };
      }

      const toolResults = toolUses.map((tu) => {
        const { result, applied } = runTool(tu.name, tu.input || {});
        if (applied) appliedAny = true;
        return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) };
      });
      messages.push({ role: "user", content: toolResults });
    }
    return { answer: "I've applied what I could — check the board and ask me to confirm the numbers.", appliedAny };
  } catch {
    if (brainAvailable === null) brainAvailable = false;
    return null;
  }
}
