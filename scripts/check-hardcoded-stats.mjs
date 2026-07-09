#!/usr/bin/env node
/*
 * scripts/check-hardcoded-stats.mjs — CI trust gate (SPEC §7 / §10.8).
 *
 * The mock footer (design/repo-seance-v2.html) claims eval statistics such as
 * "32/32" cases passing and "0 hallucinations". Per the spec those numbers must
 * be rendered from evals/results.json at build time — never hand-typed into the
 * UI. This script fails the build when a literal trust statistic appears in
 * shipped source under app/ or components/.
 *
 * It deliberately does NOT flag values interpolated from the results artifact,
 * e.g. `{results.passed}/{results.total}` or `{rate}% cited`, because those use
 * template expressions rather than literal digits — the `{` breaks every
 * literal-number pattern below.
 *
 * Plain Node, zero dependencies. Exit 1 with a file:line:col report on any
 * finding; exit 0 when the scanned source is clean.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components"];
const SOURCE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  "__tests__",
  "__mocks__",
]);
// Test/spec files may legitimately assert on literal expected strings; they are
// never shipped to the client, so they are out of scope for this gate.
const SKIP_FILE = /\.(test|spec)\.[jt]sx?$/;

// Trust/eval vocabulary. A bare fraction (Tailwind `w-1/2`, an opacity modifier
// like `bg-black/50`) or a bare percentage (CSS `width: 100%`) is only treated
// as a *trust statistic* when one of these words sits next to it. Colour names
// are intentionally excluded so `text-emerald-500/50` never trips the gate.
const TRUST_WORD =
  "pass(?:ing|ed)|hallucinat\\w*|evidence|citations?|cited|deterministic|" +
  "\\beval(?:uation|s)?\\b|\\bcases?\\b|coverage|\\btrust\\b|verified|audited|" +
  "accuracy|fidelity|refusals?";

const WINDOW = 40; // chars of context on each side of a number to search

/**
 * Collect all matches of `re` (which must be global) on a single line.
 * @returns {Array<{ col: number, text: string }>}
 */
function scanRegex(line, re) {
  const hits = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(line)) !== null) {
    hits.push({ col: m.index + 1, text: m[0].trim() });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return hits;
}

/**
 * Collect matches of `re` only when trust wording appears within WINDOW chars.
 * @returns {Array<{ col: number, text: string }>}
 */
function scanNearWord(line, re) {
  const wordRe = new RegExp(`(?:${TRUST_WORD})`, "i");
  const hits = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(line)) !== null) {
    const start = Math.max(0, m.index - WINDOW);
    const end = Math.min(line.length, m.index + m[0].length + WINDOW);
    if (wordRe.test(line.slice(start, end))) {
      hits.push({ col: m.index + 1, text: m[0].trim() });
    }
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return hits;
}

const RULES = [
  {
    // §7 names this literal explicitly — hardcoding "32/32" is banned outright.
    name: "literal-32/32",
    run: (line) => scanRegex(line, /\b32\s*\/\s*32\b/g),
  },
  {
    // "0 hallucinations", "3 hallucination" — a literal count of hallucinations.
    name: "literal-hallucination-count",
    run: (line) => scanRegex(line, /\b\d{1,5}\s+hallucinations?\b/gi),
  },
  {
    // "30/32 passing", "31 / 32 cases" — an N/N fraction next to eval wording.
    // Two *literal* numbers are required, so `{passed}/{total}` is not matched.
    name: "fraction-near-eval-wording",
    run: (line) => scanNearWord(line, /\b\d{1,5}\s*\/\s*\d{1,5}\b/g),
  },
  {
    // "{passed}/32 passing" — a hardcoded denominator glued to eval wording,
    // catching a half-hardcoded total even when the numerator is dynamic.
    name: "hardcoded-total-denominator",
    run: (line) =>
      scanRegex(line, new RegExp(`/\\s*\\d{1,5}\\s+(?:${TRUST_WORD})`, "gi")),
  },
  {
    // "98% cited", "citation rate: 100%" — a literal percentage adjacent to
    // trust wording (an evidenceCitationRate-like number typed by hand).
    name: "percentage-near-trust-wording",
    run: (line) => scanNearWord(line, /\b\d{1,3}(?:\.\d+)?\s*%/g),
  },
];

function walk(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) walk(full, acc);
    } else if (ent.isFile()) {
      if (SKIP_FILE.test(ent.name)) continue;
      if (SOURCE_EXT.has(extname(ent.name))) acc.push(full);
    }
  }
  return acc;
}

const files = [];
for (const dir of SCAN_DIRS) {
  const abs = join(ROOT, dir);
  if (existsSync(abs)) walk(abs, files);
}

/** @type {Map<string, { file: string, line: number, col: number, text: string, rules: Set<string> }>} */
const findings = new Map();
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const rel = relative(ROOT, file);
  content.split(/\r?\n/).forEach((line, idx) => {
    for (const rule of RULES) {
      for (const hit of rule.run(line)) {
        const key = `${rel}:${idx + 1}:${hit.col}`;
        const existing = findings.get(key);
        if (existing) {
          existing.rules.add(rule.name);
        } else {
          findings.set(key, {
            file: rel,
            line: idx + 1,
            col: hit.col,
            text: hit.text,
            rules: new Set([rule.name]),
          });
        }
      }
    }
  });
}

if (findings.size > 0) {
  console.error(
    "\n✗ check:stats — hardcoded trust statistics are forbidden in shipped UI (SPEC §7).",
  );
  console.error(
    "  Render these numbers from evals/results.json at build time instead.\n",
  );
  for (const f of findings.values()) {
    console.error(
      `  ${f.file}:${f.line}:${f.col}  [${[...f.rules].join(", ")}]  ${JSON.stringify(f.text)}`,
    );
  }
  const n = findings.size;
  console.error(`\n${n} hardcoded stat${n === 1 ? "" : "s"} found.`);
  process.exit(1);
}

const where = SCAN_DIRS.map((d) => `${d}/`).join(", ");
console.log(
  `✓ check:stats — no hardcoded trust statistics in ${where} (${files.length} source file${files.length === 1 ? "" : "s"} scanned).`,
);
process.exit(0);
