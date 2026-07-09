/**
 * Post-validation of a ghost answer (SPEC §5). Workstream D — the Interrogation.
 *
 * The model's raw text is never trusted directly. `finalizeGhostAnswer`:
 *   1. splits the trailing EVIDENCE block off the human-facing answer,
 *   2. validates each ref against the Dossier (invalid refs are stripped),
 *   3. resolves the survivors to real, renderable citation chips.
 *
 * The hard rule, enforced in code and not the prompt: if NO ref survives, or the
 * displayed answer is empty, or the answer simply IS the refusal, the whole thing
 * collapses to the canonical refusal with no chips. Validation is authoritative
 * over whatever the stream produced.
 */
import type { Dossier } from "../dossier/types";
import type { EvidenceRef } from "../autopsy/schema";
import { parseEvidenceBlock } from "./evidence-block";
import { validateRefs } from "../evidence/validate";
import { CANONICAL_REFUSAL } from "./refusal";

/** A resolved, renderable citation chip beneath a ghost answer. */
export interface EvidenceChip {
  type: EvidenceRef["type"];
  ref: string;
  url: string;
  label: string;
}

/** The finalized answer the route streams to the client and the client renders. */
export interface FinalizedGhostAnswer {
  /** The text to show. Equals `CANONICAL_REFUSAL` when `refused` is true. */
  display: string;
  /** True when the answer collapsed to the canonical refusal. */
  refused: boolean;
  /** Resolved evidence chips; always empty when `refused`. */
  chips: EvidenceChip[];
}

/** The canonical refusal outcome — a fresh chips array each call (no shared ref). */
function refusal(): FinalizedGhostAnswer {
  return { display: CANONICAL_REFUSAL, refused: true, chips: [] };
}

export function finalizeGhostAnswer(
  dossier: Dossier,
  rawText: string,
): FinalizedGhostAnswer {
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    return refusal();
  }

  const { display, refs } = parseEvidenceBlock(rawText);

  // An answer that IS the refusal is refused regardless of any (spurious) refs.
  if (display.trim().startsWith(CANONICAL_REFUSAL)) {
    return refusal();
  }

  const { refs: kept, resolved } = validateRefs(dossier, refs);

  // §5 all-fail policy: zero surviving refs, or an empty answer body, ⇒ refusal.
  if (kept.length === 0 || display.trim().length === 0) {
    return refusal();
  }

  const chips: EvidenceChip[] = kept.map((ref, i) => ({
    type: ref.type,
    ref: ref.ref,
    url: resolved[i].url,
    label: resolved[i].label,
  }));

  return { display, refused: false, chips };
}
