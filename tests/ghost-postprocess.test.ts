import { describe, it, expect } from "vitest";
import { finalizeGhostAnswer } from "../lib/ghost/postprocess";
import { CANONICAL_REFUSAL } from "../lib/ghost/refusal";
import { makeDossier, RECENT_SHA_1 } from "./fixtures";

const BASE = "https://github.com/atom/atom";

describe("finalizeGhostAnswer — valid evidence becomes chips", () => {
  it("resolves a commit + issue into ordered chips, refused false", () => {
    const raw =
      'The maintainer archived me.\nEVIDENCE: [{"type":"commit","ref":"a1b2c3d"},{"type":"issue","ref":"#21234"}]';
    const result = finalizeGhostAnswer(makeDossier(), raw);

    expect(result.refused).toBe(false);
    expect(result.display).toBe("The maintainer archived me.");
    expect(result.chips).toEqual([
      {
        type: "commit",
        ref: "a1b2c3d",
        url: `${BASE}/commit/${RECENT_SHA_1}`,
        label: "a1b2c3d",
      },
      {
        type: "issue",
        ref: "#21234",
        url: `${BASE}/issues/21234`,
        label: "#21234",
      },
    ]);
  });

  it("resolves branch, file, and readme refs", () => {
    const raw =
      'Look to what I left behind.\nEVIDENCE: [{"type":"branch","ref":"feature/electron-upgrade"},{"type":"file","ref":"src/main.js"},{"type":"readme","ref":"README"}]';
    const result = finalizeGhostAnswer(makeDossier(), raw);

    expect(result.refused).toBe(false);
    expect(result.chips.map((c) => c.type)).toEqual([
      "branch",
      "file",
      "readme",
    ]);
    expect(result.chips[2].label).toBe("README");
  });
});

describe("finalizeGhostAnswer — invalid refs are stripped", () => {
  it("keeps only refs that resolve when the block is mixed", () => {
    const raw =
      'Two threads.\nEVIDENCE: [{"type":"commit","ref":"a1b2c3d"},{"type":"issue","ref":"#999999"}]';
    const result = finalizeGhostAnswer(makeDossier(), raw);

    expect(result.refused).toBe(false);
    expect(result.chips).toHaveLength(1);
    expect(result.chips[0].ref).toBe("a1b2c3d");
  });
});

describe("finalizeGhostAnswer — the all-fail refusal (SPEC §5)", () => {
  it("collapses to the canonical refusal when every ref is invalid", () => {
    const raw =
      'I know all.\nEVIDENCE: [{"type":"issue","ref":"#999999"},{"type":"branch","ref":"ghost-branch"}]';
    const result = finalizeGhostAnswer(makeDossier(), raw);

    expect(result.refused).toBe(true);
    expect(result.display).toBe(CANONICAL_REFUSAL);
    expect(result.chips).toEqual([]);
  });

  it("refuses when there is no evidence block at all", () => {
    const result = finalizeGhostAnswer(
      makeDossier(),
      "Just talking; nothing to cite.",
    );
    expect(result.refused).toBe(true);
    expect(result.display).toBe(CANONICAL_REFUSAL);
  });

  it("refuses when the answer body is empty but a ref resolves", () => {
    const raw = 'EVIDENCE: [{"type":"commit","ref":"a1b2c3d"}]';
    const result = finalizeGhostAnswer(makeDossier(), raw);
    expect(result.refused).toBe(true);
    expect(result.chips).toEqual([]);
  });

  it("refuses on empty or whitespace-only raw text", () => {
    expect(finalizeGhostAnswer(makeDossier(), "").refused).toBe(true);
    expect(finalizeGhostAnswer(makeDossier(), "   \n  ").refused).toBe(true);
  });
});

describe("finalizeGhostAnswer — the refusal is sacred", () => {
  it("passes a clean refusal straight through", () => {
    const raw = `${CANONICAL_REFUSAL}\nEVIDENCE: []`;
    const result = finalizeGhostAnswer(makeDossier(), raw);
    expect(result.refused).toBe(true);
    expect(result.display).toBe(CANONICAL_REFUSAL);
    expect(result.chips).toEqual([]);
  });

  it("strips spurious evidence smuggled onto a refusal", () => {
    const raw = `${CANONICAL_REFUSAL}\nEVIDENCE: [{"type":"commit","ref":"a1b2c3d"}]`;
    const result = finalizeGhostAnswer(makeDossier(), raw);
    expect(result.refused).toBe(true);
    expect(result.display).toBe(CANONICAL_REFUSAL);
    expect(result.chips).toEqual([]);
  });
});
