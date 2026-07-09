/**
 * The wire contract for the exhumation stream (SPEC §6, architecture item 2).
 * `GET /api/exhume?owner=&repo=` emits newline-delimited JSON: zero or more
 * stage events, then exactly one terminal line. Both the route (producer) and
 * the autopsy client (consumer) import these types so the format stays honest.
 *
 * Type imports are relative and type-only so this module carries no runtime
 * dependency on the (server-only) data layer and can be pulled into the client
 * bundle and unit tests alike (tests/ui-ritual).
 */
import type { DossierStage } from "../../../lib/dossier/build";
import type { Dossier } from "../../../lib/dossier/types";
import type { Autopsy } from "../../../lib/autopsy/schema";

/** The three ritual phases the loader narrates, in order. */
export type RitualStage = "locating" | "ledger" | "contacting";

/** Terminal error codes, mapped from typed GitHub/analysis failures. */
export type ExhumeErrorCode = "not_found" | "rate_limited" | "analysis_failed";

export interface StageEvent {
  stage: RitualStage;
}
export interface DoneAutopsyEvent {
  done: true;
  dossier: Dossier;
  autopsy: Autopsy;
}
export interface DoneAliveEvent {
  done: true;
  alive: true;
  dossier: Dossier;
}
export interface ErrorEvent {
  error: ExhumeErrorCode;
}

export type ExhumeEvent =
  | StageEvent
  | DoneAutopsyEvent
  | DoneAliveEvent
  | ErrorEvent;

/**
 * Map a real Dossier build stage onto a ritual phase. `meta` is the act of
 * locating the remains; every ledger read (commits/branches/issues/readme/
 * todos) is "reading the commit ledger". The `contacting` phase is emitted by
 * the route itself, immediately before the LLM call — there is no Dossier stage
 * for it.
 */
export function ritualStageForDossierStage(stage: DossierStage): RitualStage {
  switch (stage) {
    case "meta":
      return "locating";
    case "commits":
    case "branches":
    case "issues":
    case "readme":
    case "todos":
      return "ledger";
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

export function isStageEvent(e: ExhumeEvent): e is StageEvent {
  return "stage" in e;
}
export function isErrorEvent(e: ExhumeEvent): e is ErrorEvent {
  return "error" in e;
}
export function isAliveEvent(e: ExhumeEvent): e is DoneAliveEvent {
  return "done" in e && "alive" in e;
}
export function isAutopsyEvent(e: ExhumeEvent): e is DoneAutopsyEvent {
  return "done" in e && !("alive" in e);
}
