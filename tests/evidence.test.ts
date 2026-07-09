import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolveEvidence,
  validateEvidence,
  validateRefs,
} from "../lib/evidence/validate";
import type { Cause, EvidenceRef } from "../lib/autopsy/schema";
import {
  makeDossier,
  RECENT_SHA_1,
  FINAL_SHA,
} from "./fixtures";

const BASE = "https://github.com/atom/atom";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveEvidence — commit refs", () => {
  const dossier = makeDossier();

  it("resolves a 7-char prefix of a recent commit to its full-sha URL", () => {
    const result = resolveEvidence(dossier, { type: "commit", ref: "a1b2c3d" });
    expect(result).toEqual({
      url: `${BASE}/commit/${RECENT_SHA_1}`,
      label: "a1b2c3d",
    });
  });

  it("matches a prefix case-insensitively but labels with the canonical sha", () => {
    expect(resolveEvidence(dossier, { type: "commit", ref: "A1B2C3D" })).toEqual({
      url: `${BASE}/commit/${RECENT_SHA_1}`,
      label: "a1b2c3d",
    });
  });

  it("resolves against the final commit as well as the recent set", () => {
    expect(resolveEvidence(dossier, { type: "commit", ref: "f00dcaf" })).toEqual({
      url: `${BASE}/commit/${FINAL_SHA}`,
      label: "f00dcaf",
    });
  });

  it("resolves a full 40-char sha", () => {
    expect(
      resolveEvidence(dossier, { type: "commit", ref: RECENT_SHA_1 })?.url,
    ).toBe(`${BASE}/commit/${RECENT_SHA_1}`);
  });

  it("rejects a prefix shorter than 7 chars", () => {
    expect(resolveEvidence(dossier, { type: "commit", ref: "a1b2c" })).toBeNull();
  });

  it("rejects a 7-char prefix that matches nothing", () => {
    expect(resolveEvidence(dossier, { type: "commit", ref: "9999999" })).toBeNull();
  });
});

describe("resolveEvidence — issue refs", () => {
  const dossier = makeDossier();

  it("resolves a #-prefixed issue number that exists", () => {
    expect(resolveEvidence(dossier, { type: "issue", ref: "#21234" })).toEqual({
      url: `${BASE}/issues/21234`,
      label: "#21234",
    });
  });

  it("resolves a bare issue number", () => {
    expect(resolveEvidence(dossier, { type: "issue", ref: "21234" })).toEqual({
      url: `${BASE}/issues/21234`,
      label: "#21234",
    });
  });

  it("rejects an issue number not in the fetched set", () => {
    expect(resolveEvidence(dossier, { type: "issue", ref: "#999" })).toBeNull();
  });

  it("rejects a non-numeric issue ref", () => {
    expect(resolveEvidence(dossier, { type: "issue", ref: "abc" })).toBeNull();
  });
});

describe("resolveEvidence — branch refs", () => {
  const dossier = makeDossier();

  it("resolves an exact branch name", () => {
    expect(resolveEvidence(dossier, { type: "branch", ref: "master" })).toEqual({
      url: `${BASE}/tree/master`,
      label: "master",
    });
  });

  it("preserves slashes in a branch path", () => {
    expect(
      resolveEvidence(dossier, { type: "branch", ref: "feature/electron-upgrade" }),
    ).toEqual({
      url: `${BASE}/tree/feature/electron-upgrade`,
      label: "feature/electron-upgrade",
    });
  });

  it("rejects an unknown branch", () => {
    expect(resolveEvidence(dossier, { type: "branch", ref: "nope" })).toBeNull();
  });
});

describe("resolveEvidence — file refs", () => {
  const dossier = makeDossier();

  it("resolves a scanned TODO path to a blob URL on the default branch", () => {
    expect(resolveEvidence(dossier, { type: "file", ref: "src/main.js" })).toEqual({
      url: `${BASE}/blob/master/src/main.js`,
      label: "src/main.js",
    });
  });

  it("resolves a nested TODO path", () => {
    expect(
      resolveEvidence(dossier, { type: "file", ref: "lib/parser/index.ts" })?.url,
    ).toBe(`${BASE}/blob/master/lib/parser/index.ts`);
  });

  it("rejects a path that was not part of the TODO scan", () => {
    expect(resolveEvidence(dossier, { type: "file", ref: "README.md" })).toBeNull();
  });
});

describe("resolveEvidence — readme refs", () => {
  it("resolves when a README excerpt was captured", () => {
    expect(
      resolveEvidence(makeDossier(), { type: "readme", ref: "README" }),
    ).toEqual({ url: `${BASE}#readme`, label: "README" });
  });

  it("rejects when there is no README excerpt", () => {
    const dossier = makeDossier({ readme: { excerpt: null, truncated: false } });
    expect(resolveEvidence(dossier, { type: "readme", ref: "README" })).toBeNull();
  });
});

describe("validateEvidence — stripping and dropping", () => {
  it("strips invalid refs, drops evidence-less causes, and logs once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dossier = makeDossier();
    const causes: Cause[] = [
      {
        label: "Abandoned by its maintainer",
        confidencePct: 80,
        evidence: [
          { type: "commit", ref: "a1b2c3d" }, // valid
          { type: "issue", ref: "#999" }, // invalid -> stripped
        ],
      },
      {
        label: "Fabricated cause",
        confidencePct: 50,
        evidence: [
          { type: "issue", ref: "#999" }, // invalid
          { type: "branch", ref: "ghost" }, // invalid
        ],
      },
      {
        label: "Documentation rot",
        confidencePct: 30,
        evidence: [{ type: "readme", ref: "README" }], // valid
      },
    ];

    const result = validateEvidence(dossier, causes);

    expect(result.causes).toHaveLength(2);
    expect(result.causes[0].label).toBe("Abandoned by its maintainer");
    expect(result.causes[0].evidence).toEqual([{ type: "commit", ref: "a1b2c3d" }]);
    expect(result.causes[1].label).toBe("Documentation rot");

    expect(result.strippedRefs).toHaveLength(3);
    expect(result.droppedCauses).toHaveLength(1);
    expect(result.droppedCauses[0].label).toBe("Fabricated cause");

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("is silent and passes causes through untouched when all evidence resolves", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dossier = makeDossier();
    const causes: Cause[] = [
      {
        label: "Fully cited",
        confidencePct: 90,
        evidence: [
          { type: "commit", ref: "a1b2c3d" },
          { type: "branch", ref: "master" },
        ],
      },
      {
        label: "Also cited",
        confidencePct: 40,
        evidence: [{ type: "issue", ref: "21234" }],
      },
    ];

    const result = validateEvidence(dossier, causes);
    expect(result.causes).toEqual(causes);
    expect(result.strippedRefs).toHaveLength(0);
    expect(result.droppedCauses).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("validateRefs — flat ghost-answer evidence", () => {
  it("keeps resolvable refs and reports the strays", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const dossier = makeDossier();
    const refs: EvidenceRef[] = [
      { type: "commit", ref: "a1b2c3d" },
      { type: "issue", ref: "#999" },
    ];

    const result = validateRefs(dossier, refs);
    expect(result.refs).toEqual([{ type: "commit", ref: "a1b2c3d" }]);
    expect(result.resolved).toEqual([
      { url: `${BASE}/commit/${RECENT_SHA_1}`, label: "a1b2c3d" },
    ]);
    expect(result.strippedRefs).toEqual([{ type: "issue", ref: "#999" }]);
  });

  it("returns nothing resolvable when every ref is bogus (caller then refuses)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const dossier = makeDossier();
    const result = validateRefs(dossier, [
      { type: "issue", ref: "#999" },
      { type: "branch", ref: "ghost" },
    ]);
    expect(result.resolved).toHaveLength(0);
    expect(result.refs).toHaveLength(0);
    expect(result.strippedRefs).toHaveLength(2);
  });
});
