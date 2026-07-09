/**
 * Ghost-answer finalization for the eval harness (SPEC §5).
 *
 * `finalizeAnswer` runs a raw ghost answer through the exact production path —
 * `lib/ghost/postprocess.finalizeGhostAnswer` (workstream D) — so the refusal,
 * numeric-fidelity, and injection cases judge what production would actually
 * show. `finalizeViaPrimitives` is the same §5 contract rebuilt from the frozen
 * primitives (`parseEvidenceBlock` + `validateRefs` + `CANONICAL_REFUSAL`); it is
 * the deterministic reference the unit tests pin, independent of the route code.
 */
import type { Dossier } from "../lib/dossier/types";
import type { ResolvedEvidence } from "../lib/evidence/validate";
import { validateRefs } from "../lib/evidence/validate";
import { parseEvidenceBlock } from "../lib/ghost/evidence-block";
import { CANONICAL_REFUSAL } from "../lib/ghost/refusal";
import { finalizeGhostAnswer } from "../lib/ghost/postprocess";

/** A finalized ghost answer, normalized to what the harness asserts against. */
export interface FinalizedAnswer {
  /** Human-facing text (exactly CANONICAL_REFUSAL when refused). */
  text: string;
  /** Resolved, renderable citations. Empty on a refusal. */
  chips: ResolvedEvidence[];
  /** True when the answer collapsed to the canonical refusal. */
  refused: boolean;
}

/**
 * Finalize via the production route (`finalizeGhostAnswer`) and normalize its
 * `{ display, refused, chips }` result to `FinalizedAnswer`.
 */
export function finalizeAnswer(rawText: string, dossier: Dossier): FinalizedAnswer {
  const result = finalizeGhostAnswer(dossier, rawText);
  return {
    text: result.display,
    chips: result.chips.map((chip) => ({ url: chip.url, label: chip.label })),
    refused: result.refused,
  };
}

/**
 * The §5 finalization rebuilt from the frozen primitives — a deterministic
 * reference for the unit tests. An answer whose refs all fail to resolve becomes
 * the canonical refusal with zero chips.
 */
export function finalizeViaPrimitives(
  rawText: string,
  dossier: Dossier,
): FinalizedAnswer {
  const { display, refs } = parseEvidenceBlock(rawText);
  const { resolved } = validateRefs(dossier, refs);
  if (resolved.length === 0) {
    return { text: CANONICAL_REFUSAL, chips: [], refused: true };
  }
  return { text: display, chips: resolved, refused: false };
}
