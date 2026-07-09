import { describe, it, expect } from "vitest";
import {
  ritualStageForDossierStage,
  isStageEvent,
  isErrorEvent,
  isAliveEvent,
  isAutopsyEvent,
  type ExhumeEvent,
} from "../app/api/exhume/protocol";
import type { DossierStage } from "../lib/dossier/build";
import type { Dossier } from "../lib/dossier/types";
import type { Autopsy } from "../lib/autopsy/schema";

describe("ritualStageForDossierStage", () => {
  it("maps meta to the locating phase", () => {
    expect(ritualStageForDossierStage("meta")).toBe("locating");
  });

  it("maps every ledger read to the ledger phase", () => {
    const ledgerStages: DossierStage[] = [
      "commits",
      "branches",
      "issues",
      "readme",
      "todos",
    ];
    for (const stage of ledgerStages) {
      expect(ritualStageForDossierStage(stage)).toBe("ledger");
    }
  });
});

describe("exhume event type guards", () => {
  const dossier = {} as Dossier;
  const autopsy = {} as Autopsy;

  const stage: ExhumeEvent = { stage: "ledger" };
  const alive: ExhumeEvent = { done: true, alive: true, dossier };
  const done: ExhumeEvent = { done: true, dossier, autopsy };
  const err: ExhumeEvent = { error: "not_found" };

  it("discriminates a stage event", () => {
    expect(isStageEvent(stage)).toBe(true);
    expect(isErrorEvent(stage)).toBe(false);
  });

  it("discriminates the alive terminal from the autopsy terminal", () => {
    expect(isAliveEvent(alive)).toBe(true);
    expect(isAutopsyEvent(alive)).toBe(false);
    expect(isAutopsyEvent(done)).toBe(true);
    expect(isAliveEvent(done)).toBe(false);
  });

  it("discriminates an error event", () => {
    expect(isErrorEvent(err)).toBe(true);
    expect(isStageEvent(err)).toBe(false);
    expect(isAutopsyEvent(err)).toBe(false);
  });
});
