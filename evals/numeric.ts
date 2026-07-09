/**
 * Numeric-fidelity matcher (SPEC §7). Pure, deterministic string helpers used by
 * the eval harness to check that a ghost/autopsy claim states the exact Dossier
 * number — allowing thousands separators — and does not place a CONTRADICTING
 * number next to the metric keyword.
 *
 * "Exact for counts": the expected value must appear verbatim (modulo `,`
 * thousands grouping), and the integer nearest the metric keyword must equal it.
 * These functions are unit-tested in tests/evals-numeric.test.ts.
 */

/**
 * Matches a standalone base-10 integer, optionally written with `,` thousands
 * separators, that is NOT part of a decimal (`3.4`), a version (`v3`), or a
 * longer alphanumeric token (`12px`). A trailing sentence period is allowed.
 */
const INT_TOKEN_RE =
  /(?<![\w.,])\d{1,3}(?:,\d{3})+(?![\w])(?!\.\d)|(?<![\w.,])\d+(?![\w])(?!\.\d)/g;

/** One integer found in text, with its character span for adjacency math. */
export interface IntegerToken {
  value: number;
  start: number;
  end: number;
}

/** Extract every standalone integer token (with span), left to right. */
export function extractIntegerTokens(text: string): IntegerToken[] {
  const tokens: IntegerToken[] = [];
  for (const match of text.matchAll(INT_TOKEN_RE)) {
    const raw = match[0];
    const value = Number(raw.replace(/,/g, ""));
    if (Number.isFinite(value) && match.index !== undefined) {
      tokens.push({ value, start: match.index, end: match.index + raw.length });
    }
  }
  return tokens;
}

/** The plain numeric values of every standalone integer in text. */
export function extractIntegers(text: string): number[] {
  return extractIntegerTokens(text).map((t) => t.value);
}

/**
 * True when `value` appears in `text` as a standalone integer, tolerating
 * thousands separators (so `48213` matches "48,213" and "48213").
 */
export function textContainsInteger(text: string, value: number): boolean {
  return extractIntegers(text).some((n) => n === value);
}

/** Case-insensitive character spans of every `keyword` occurrence in text. */
function keywordSpans(text: string, keyword: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  if (keyword.length === 0) return spans;
  const hay = text.toLowerCase();
  const needle = keyword.toLowerCase();
  let from = 0;
  for (;;) {
    const idx = hay.indexOf(needle, from);
    if (idx === -1) break;
    spans.push([idx, idx + needle.length]);
    from = idx + needle.length;
  }
  return spans;
}

/** Gap (in chars) between two spans; 0 when they overlap. */
function spanDistance(a: [number, number], b: [number, number]): number {
  if (a[1] <= b[0]) return b[0] - a[1];
  if (b[1] <= a[0]) return a[0] - b[1];
  return 0;
}

/**
 * The integer token closest to any occurrence of `keyword`, within `window`
 * characters, or null when no integer sits that near the keyword. Ties break to
 * the earliest token.
 */
export function nearestNumberToKeyword(
  text: string,
  keyword: string,
  window = 40,
): number | null {
  const spans = keywordSpans(text, keyword);
  if (spans.length === 0) return null;

  let best: { value: number; distance: number; start: number } | null = null;
  for (const token of extractIntegerTokens(text)) {
    let minDist = Number.POSITIVE_INFINITY;
    for (const span of spans) {
      minDist = Math.min(minDist, spanDistance([token.start, token.end], span));
    }
    if (minDist > window) continue;
    if (
      best === null ||
      minDist < best.distance ||
      (minDist === best.distance && token.start < best.start)
    ) {
      best = { value: token.value, distance: minDist, start: token.start };
    }
  }
  return best === null ? null : best.value;
}

/**
 * True when a number sits next to the metric keyword that CONTRADICTS the
 * expected value — i.e. the integer nearest the keyword is present but differs.
 * A keyword with no adjacent integer is not a contradiction (the exact value may
 * appear elsewhere in the sentence).
 */
export function hasContradictingNumber(
  text: string,
  keyword: string,
  expected: number,
  window = 40,
): boolean {
  const nearest = nearestNumberToKeyword(text, keyword, window);
  return nearest !== null && nearest !== expected;
}

/** Outcome of a numeric-fidelity check, with a human-readable reason on failure. */
export interface NumericCheck {
  pass: boolean;
  /** True when a contradicting adjacent number was found (a hallucination). */
  contradiction: boolean;
  reason: string;
}

/**
 * The full §7 numeric-fidelity rule for one metric claim: the exact value must
 * appear (thousands separators allowed) AND no contradicting number may sit next
 * to the metric keyword.
 */
export function checkNumericFidelity(
  text: string,
  keyword: string,
  expected: number,
  window = 40,
): NumericCheck {
  const present = textContainsInteger(text, expected);
  const contradiction = hasContradictingNumber(text, keyword, expected, window);
  if (!present) {
    return {
      pass: false,
      contradiction,
      reason: `expected exact value ${expected} not found near "${keyword}"`,
    };
  }
  if (contradiction) {
    const nearest = nearestNumberToKeyword(text, keyword, window);
    return {
      pass: false,
      contradiction: true,
      reason: `contradicting number ${String(nearest)} adjacent to "${keyword}" (expected ${expected})`,
    };
  }
  return { pass: true, contradiction: false, reason: "exact numeric match" };
}
