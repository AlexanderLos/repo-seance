/**
 * The strictly-validated shape the autopsy LLM call must return (SPEC §4).
 * `EvidenceRef` lives here as the single source of truth — the evidence
 * validator (`lib/evidence`) and the ghost's evidence block (`lib/ghost`) both
 * import it, so autopsy and chat speak exactly the same citation language.
 */
import { z } from "zod";

/** The five kinds of thing a citation can point at inside a Dossier. */
export const EVIDENCE_TYPES = [
  "commit",
  "issue",
  "branch",
  "file",
  "readme",
] as const;

/** A pointer into the Dossier: a type plus a raw reference string. */
export const EvidenceRefSchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  ref: z.string().min(1),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

/** One ranked cause of death, carrying its supporting evidence (SPEC §4). */
export const CauseSchema = z.object({
  label: z.string().min(1),
  confidencePct: z.number().int().min(0).max(100),
  evidence: z.array(EvidenceRefSchema),
});
export type Cause = z.infer<typeof CauseSchema>;

/** One step in the revival plan. */
export const RevivalStepSchema = z.object({
  step: z.string().min(1),
  effort: z.string().min(1),
});
export type RevivalStep = z.infer<typeof RevivalStepSchema>;

/** The full autopsy report (SPEC §4). */
export const AutopsySchema = z.object({
  epitaph: z.string().min(1),
  causes: z.array(CauseSchema).min(2).max(4),
  revival: z.array(RevivalStepSchema).min(3).max(5),
  lastWordsGloss: z.string().min(1),
});
export type Autopsy = z.infer<typeof AutopsySchema>;
