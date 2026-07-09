import { describe, it, expect } from "vitest";
import { finalizeAnswer, finalizeViaPrimitives } from "../evals/finalize";
import { CANONICAL_REFUSAL } from "../lib/ghost/refusal";
import { makeDossier, RECENT_SHA_1 } from "./fixtures";

const dossier = makeDossier();

const EVIDENCED = `I recall it well.\n\nEVIDENCE: [{"type":"commit","ref":"${RECENT_SHA_1}"}]`;
const EMPTY_BLOCK = "That is beyond my ledger.\n\nEVIDENCE: []";
const BOGUS_REF = 'Something.\n\nEVIDENCE: [{"type":"commit","ref":"0000000000"}]';

describe("finalizeViaPrimitives (§5 reference)", () => {
  it("keeps the display and resolves chips for a real citation", () => {
    const r = finalizeViaPrimitives(EVIDENCED, dossier);
    expect(r.refused).toBe(false);
    expect(r.text).toBe("I recall it well.");
    expect(r.chips.length).toBe(1);
    expect(r.chips[0].label).toBe(RECENT_SHA_1.slice(0, 7));
  });

  it("collapses to the canonical refusal for an empty evidence block", () => {
    const r = finalizeViaPrimitives(EMPTY_BLOCK, dossier);
    expect(r.refused).toBe(true);
    expect(r.text).toBe(CANONICAL_REFUSAL);
    expect(r.chips).toEqual([]);
  });

  it("collapses to the canonical refusal when every ref fails to resolve", () => {
    const r = finalizeViaPrimitives(BOGUS_REF, dossier);
    expect(r.refused).toBe(true);
    expect(r.text).toBe(CANONICAL_REFUSAL);
    expect(r.chips).toEqual([]);
  });
});

describe("finalizeAnswer (production route, correct arg order)", () => {
  it("keeps the display and chips for a real citation", () => {
    const r = finalizeAnswer(EVIDENCED, dossier);
    expect(r.refused).toBe(false);
    expect(r.text).toBe("I recall it well.");
    expect(r.chips.length).toBeGreaterThanOrEqual(1);
    expect(typeof r.chips[0].url).toBe("string");
  });

  it("refuses an empty evidence block with zero chips", () => {
    const r = finalizeAnswer(EMPTY_BLOCK, dossier);
    expect(r.refused).toBe(true);
    expect(r.text).toBe(CANONICAL_REFUSAL);
    expect(r.chips).toEqual([]);
  });
});
