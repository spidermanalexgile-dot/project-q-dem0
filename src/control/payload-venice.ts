import type { Payload } from "./state";
import veniceDpm from "../../dpm-payloads/venice-2026.json";

/**
 * Default boot payload — Ollie's first DPM output for Venice 2026.
 *
 * This is imported VERBATIM from ./dpm-payloads/venice-2026.json (the file saved
 * exactly as it appeared in Ollie's DPM PDF). Nothing about Venice — capacity,
 * confidence, day types, curve shape — is special-cased or inlined in UI code;
 * the dashboard reads it all from this payload via loadPayload().
 *
 * NOTE: the raw file encodes curve.shape.exponent as an integer ×10 (e.g. 22 for
 * 2.2). That quirk is normalized centrally inside loadPayload() — see
 * normalizeCurveExponent() in state.ts. We deliberately do NOT pre-correct it
 * here, so this stays a faithful copy of the DPM output and every load path
 * (boot, file upload, drag-drop, agent) goes through the same normalization.
 *
 * To pitch a different city, drop its DPM payload in via the TopBar upload
 * affordance (Cmd/Ctrl+O or drag-drop) — no code change needed.
 */
export const PAYLOAD_VENICE = veniceDpm as unknown as Payload;
