import { describe, it, expect } from "vitest";
import {
  extractIntegers,
  textContainsInteger,
  nearestNumberToKeyword,
  integersNearKeyword,
  hasContradictingNumber,
  checkNumericFidelity,
} from "../evals/numeric";

/** The recorded num-dying-open ghost answer (evals/recorded/chat/num-dying-open.json). */
const NUM_DYING_OPEN =
  "3 of my wounds remain open — 2 bugs and 1 unfinished dream of a streaming API — and no maintainer has yet come to close them.";

describe("extractIntegers", () => {
  it("reads plain and thousands-separated integers", () => {
    expect(extractIntegers("You died with 48,213 stars.")).toEqual([48213]);
    expect(extractIntegers("48213 commits and 1,234,567 lines")).toEqual([48213, 1234567]);
  });

  it("ignores decimals, versions, and alphanumeric tokens", () => {
    expect(extractIntegers("v3.4.0 released")).toEqual([]);
    expect(extractIntegers("3.5 issues per week")).toEqual([]);
    expect(extractIntegers("a 12px margin")).toEqual([]);
  });

  it("allows a trailing sentence period", () => {
    expect(extractIntegers("You had 838 days.")).toEqual([838]);
  });
});

describe("textContainsInteger", () => {
  it("matches with and without thousands separators", () => {
    expect(textContainsInteger("48,213 stars", 48213)).toBe(true);
    expect(textContainsInteger("48213 stars", 48213)).toBe(true);
  });

  it("does not match a numeric prefix of a longer number", () => {
    expect(textContainsInteger("482130 stars", 48213)).toBe(false);
    expect(textContainsInteger("4821 stars", 48213)).toBe(false);
  });
});

describe("nearestNumberToKeyword", () => {
  it("picks the integer adjacent to the keyword, not a distant one", () => {
    expect(nearestNumberToKeyword("You died with 48,213 stars back in 2024", "star")).toBe(48213);
  });

  it("returns null when no integer sits near the keyword", () => {
    expect(nearestNumberToKeyword("a long story about your stars and their fate", "star")).toBeNull();
    expect(nearestNumberToKeyword("no keyword present, only 42 here", "star")).toBeNull();
  });
});

describe("integersNearKeyword", () => {
  it("collects every integer within the window, not just the nearest", () => {
    // "3" (dist 21), "2" (dist 3) and "1" (dist 14) all sit within 40 chars of "open".
    expect(integersNearKeyword(NUM_DYING_OPEN, "open")).toEqual([3, 2, 1]);
  });

  it("excludes integers beyond the window", () => {
    expect(
      integersNearKeyword(
        "14 open issues remained when the archive closed over me — 8 of them unanswered",
        "open",
      ),
    ).toEqual([14]);
  });

  it("returns empty when the keyword is absent or no integer is near", () => {
    expect(integersNearKeyword("your wounds remain open", "open")).toEqual([]);
    expect(integersNearKeyword("only 42 here", "star")).toEqual([]);
  });
});

describe("hasContradictingNumber", () => {
  it("flags a wrong number sitting next to the keyword", () => {
    expect(hasContradictingNumber("You had 500 stars", "star", 48213)).toBe(true);
  });

  it("does not flag when the adjacent number is the expected one", () => {
    expect(hasContradictingNumber("You died with 48,213 stars", "star", 48213)).toBe(false);
  });

  it("does not flag when no number is adjacent to the keyword", () => {
    expect(hasContradictingNumber("your stars faded quietly", "star", 48213)).toBe(false);
  });

  it("does not flag when the expected value is inside the window, even if a nearer number differs", () => {
    // The num-dying-open shape: 3 is in the window though "2" is closer to "open".
    expect(hasContradictingNumber(NUM_DYING_OPEN, "open", 3)).toBe(false);
  });

  it("flags when the expected value is absent from the window and a different number is adjacent", () => {
    expect(hasContradictingNumber("2 bugs remain open", "open", 3)).toBe(true);
  });
});

describe("checkNumericFidelity", () => {
  it("passes on an exact, adjacent match", () => {
    const r = checkNumericFidelity("You died with 48,213 stars.", "star", 48213);
    expect(r.pass).toBe(true);
    expect(r.contradiction).toBe(false);
  });

  it("fails when the exact value is absent", () => {
    const r = checkNumericFidelity("You had roughly five hundred stars.", "star", 48213);
    expect(r.pass).toBe(false);
    expect(r.reason).toContain("not found");
  });

  it("fails on a contradicting adjacent number when the exact value is only far away", () => {
    // Updated from the old nearest-token behavior: with the window rule the
    // expected value counts as adjacent only when it sits INSIDE the window, so
    // to still prove a contradiction the exact 48213 is pushed out of range and
    // the number beside "stars" is the wrong 500.
    const r = checkNumericFidelity(
      "The number 48213 was carved on a headstone in another cemetery entirely, yet here you lie with only 500 stars.",
      "star",
      48213,
    );
    expect(r.pass).toBe(false);
    expect(r.contradiction).toBe(true);
  });

  it("counts a single-digit count exactly", () => {
    const r = checkNumericFidelity("3 issues remain open, unanswered.", "open", 3);
    expect(r.pass).toBe(true);
  });

  // ── Matcher false-positive fix (F2): the num-dying-open regression ──────────
  it("passes the num-dying-open answer — the exact count sits in the window", () => {
    const r = checkNumericFidelity(NUM_DYING_OPEN, "open", 3);
    expect(r.pass).toBe(true);
    expect(r.contradiction).toBe(false);
  });

  it("passes when the exact count is adjacent and a later count is out of window", () => {
    const r = checkNumericFidelity(
      "14 open issues remained when the archive closed over me — 8 of them unanswered",
      "open",
      14,
    );
    expect(r.pass).toBe(true);
    expect(r.contradiction).toBe(false);
  });

  it("fails when the stated count is wrong and the expected value is absent", () => {
    const r = checkNumericFidelity("5 of my wounds remain open", "open", 3);
    expect(r.pass).toBe(false);
    expect(r.contradiction).toBe(true);
  });

  it("fails when the expected value is absent and a different number is adjacent", () => {
    const r = checkNumericFidelity("2 bugs remain open", "open", 3);
    expect(r.pass).toBe(false);
    expect(r.contradiction).toBe(true);
  });

  it("fails as unverifiable when no number sits near the keyword (missing, not contradicting)", () => {
    const r = checkNumericFidelity("your wounds remain open", "open", 3);
    expect(r.pass).toBe(false);
    expect(r.contradiction).toBe(false);
    expect(r.reason).toContain("not found");
  });
});
