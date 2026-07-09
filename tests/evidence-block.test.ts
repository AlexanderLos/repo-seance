import { describe, it, expect } from "vitest";
import { parseEvidenceBlock } from "../lib/ghost/evidence-block";

describe("parseEvidenceBlock — well-formed blocks", () => {
  it("splits a single-line EVIDENCE block off the answer", () => {
    const text =
      'The maintainer moved on.\nEVIDENCE: [{"type":"commit","ref":"a1b2c3d"}]';
    const { display, refs } = parseEvidenceBlock(text);
    expect(display).toBe("The maintainer moved on.");
    expect(refs).toEqual([{ type: "commit", ref: "a1b2c3d" }]);
  });

  it("tolerates trailing whitespace and blank lines", () => {
    const text =
      'It simply stopped.\nEVIDENCE: [{"type":"issue","ref":"#42"}]\n\n   \n';
    const { display, refs } = parseEvidenceBlock(text);
    expect(display).toBe("It simply stopped.");
    expect(refs).toEqual([{ type: "issue", ref: "#42" }]);
  });

  it("parses multiple refs in one block", () => {
    const text =
      'Two threads unravelled.\nEVIDENCE: [{"type":"commit","ref":"a1b2c3d"},{"type":"readme","ref":"README"}]';
    const { refs } = parseEvidenceBlock(text);
    expect(refs).toHaveLength(2);
    expect(refs[1]).toEqual({ type: "readme", ref: "README" });
  });

  it("keeps a multi-sentence answer intact", () => {
    const text =
      'I built it in a weekend. Then life intervened. The tests still fail.\nEVIDENCE: [{"type":"branch","ref":"main"}]';
    expect(parseEvidenceBlock(text).display).toBe(
      "I built it in a weekend. Then life intervened. The tests still fail.",
    );
  });
});

describe("parseEvidenceBlock — code fences", () => {
  it("unwraps a fenced JSON payload after the marker", () => {
    const text =
      "I cannot recall the details.\nEVIDENCE:\n```json\n[{\"type\":\"issue\",\"ref\":\"#42\"}]\n```";
    const { display, refs } = parseEvidenceBlock(text);
    expect(display).toBe("I cannot recall the details.");
    expect(refs).toEqual([{ type: "issue", ref: "#42" }]);
  });

  it("unwraps a whole-reply fence around answer and block", () => {
    const text =
      '```\nThe end came quietly.\nEVIDENCE: [{"type":"branch","ref":"main"}]\n```';
    const { display, refs } = parseEvidenceBlock(text);
    expect(display).toBe("The end came quietly.");
    expect(refs).toEqual([{ type: "branch", ref: "main" }]);
  });
});

describe("parseEvidenceBlock — malformed or missing", () => {
  it("returns no refs when the EVIDENCE line is absent", () => {
    const text = "Just talking; there is nothing to cite.";
    const { display, refs } = parseEvidenceBlock(text);
    expect(display).toBe("Just talking; there is nothing to cite.");
    expect(refs).toEqual([]);
  });

  it("returns no refs when the JSON is broken, but preserves the answer", () => {
    const text = "Something went wrong here.\nEVIDENCE: [not valid json";
    const { display, refs } = parseEvidenceBlock(text);
    expect(display).toBe("Something went wrong here.");
    expect(refs).toEqual([]);
  });

  it("returns no refs when the block is not a JSON array", () => {
    const text = 'An answer.\nEVIDENCE: {"type":"commit","ref":"a1b2c3d"}';
    expect(parseEvidenceBlock(text).refs).toEqual([]);
  });

  it("keeps only the structurally-valid entries in a mixed array", () => {
    const text =
      'Partly cited.\nEVIDENCE: [{"type":"commit","ref":"a1b2c3d"},{"type":"bogus","ref":"y"},{"type":"issue","ref":""}]';
    const { refs } = parseEvidenceBlock(text);
    expect(refs).toEqual([{ type: "commit", ref: "a1b2c3d" }]);
  });

  it("handles an empty string", () => {
    expect(parseEvidenceBlock("")).toEqual({ display: "", refs: [] });
  });

  it("handles an empty evidence array", () => {
    const text = "Nothing survives.\nEVIDENCE: []";
    const { display, refs } = parseEvidenceBlock(text);
    expect(display).toBe("Nothing survives.");
    expect(refs).toEqual([]);
  });
});
