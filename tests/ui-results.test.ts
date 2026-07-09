import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseEvalResults,
  readEvalResults,
  footerView,
  type EvalResults,
} from "../components/util/results";

const VALID: EvalResults = {
  total: 32,
  passed: 32,
  evidenceCitationRate: 0.94,
  hallucinationCount: 0,
  generatedAt: "2026-01-01T00:00:00.000Z",
};

const tempDirs: string[] = [];
function tempResults(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "seance-results-"));
  tempDirs.push(dir);
  const file = join(dir, "results.json");
  writeFileSync(file, content, "utf8");
  return file;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

describe("parseEvalResults", () => {
  it("accepts a well-formed artifact", () => {
    expect(parseEvalResults({ ...VALID })).toEqual(VALID);
  });

  it("rejects non-objects and missing fields", () => {
    expect(parseEvalResults(null)).toBeNull();
    expect(parseEvalResults("nope")).toBeNull();
    expect(parseEvalResults({ total: 32 })).toBeNull();
  });

  it("rejects impossible numbers", () => {
    expect(parseEvalResults({ ...VALID, passed: 40 })).toBeNull(); // passed > total
    expect(parseEvalResults({ ...VALID, evidenceCitationRate: 1.5 })).toBeNull();
    expect(parseEvalResults({ ...VALID, hallucinationCount: -1 })).toBeNull();
  });
});

describe("readEvalResults", () => {
  it("returns null when the file is absent", () => {
    expect(readEvalResults(join(tmpdir(), "definitely-missing-xyz.json"))).toBeNull();
  });

  it("returns null on malformed JSON or wrong shape", () => {
    expect(readEvalResults(tempResults("{ not json"))).toBeNull();
    expect(readEvalResults(tempResults('{"schema":"only"}'))).toBeNull();
  });

  it("parses a valid artifact from disk", () => {
    expect(readEvalResults(tempResults(JSON.stringify(VALID)))).toEqual(VALID);
  });
});

describe("footerView", () => {
  it("is honest and empty when no results exist", () => {
    const view = footerView(null);
    expect(view.present).toBe(false);
    expect(view.verified).toBe(false);
    expect(view.total).toBeNull();
  });

  it("is verified only when everything passed with zero hallucinations", () => {
    const view = footerView(VALID);
    expect(view.present).toBe(true);
    expect(view.verified).toBe(true);
    expect(view.citePct).toBe(94);
  });

  it("is present-but-unverified when a case failed", () => {
    const view = footerView({ ...VALID, passed: 31 });
    expect(view.present).toBe(true);
    expect(view.verified).toBe(false);
  });

  it("is unverified when a hallucination was detected", () => {
    expect(footerView({ ...VALID, hallucinationCount: 1 }).verified).toBe(false);
  });
});
