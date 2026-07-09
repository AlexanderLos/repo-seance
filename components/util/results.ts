/**
 * The footer's trust numbers come from here — never hand-typed (SPEC §7, the
 * CI grep gate). `readEvalResults` loads `evals/results.json` at server/build
 * time; `parseEvalResults` validates its shape; `footerView` turns it into a
 * render model that is honest whether the artifact is present, absent, or
 * failing. The pure functions are unit-tested (tests/ui-results); the fs read
 * is intentionally thin and only ever imported by the server-rendered footer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The artifact shape emitted by `pnpm evals` (evals/results.schema.json). */
export interface EvalResults {
  total: number;
  passed: number;
  evidenceCitationRate: number;
  hallucinationCount: number;
  generatedAt: string;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Validate an untrusted parsed value into `EvalResults`, or null if malformed. */
export function parseEvalResults(raw: unknown): EvalResults | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const total = finiteNumber(r.total);
  const passed = finiteNumber(r.passed);
  const rate = finiteNumber(r.evidenceCitationRate);
  const halluc = finiteNumber(r.hallucinationCount);
  const generatedAt = typeof r.generatedAt === "string" ? r.generatedAt : null;

  if (
    total === null ||
    passed === null ||
    rate === null ||
    halluc === null ||
    generatedAt === null
  ) {
    return null;
  }
  if (
    total < 0 ||
    passed < 0 ||
    passed > total ||
    rate < 0 ||
    rate > 1 ||
    halluc < 0
  ) {
    return null;
  }

  return {
    total,
    passed,
    evidenceCitationRate: rate,
    hallucinationCount: halluc,
    generatedAt,
  };
}

/**
 * Read and validate `evals/results.json`. Returns null on any failure (missing
 * file, bad JSON, wrong shape) so the footer can speak honestly instead of
 * throwing. `path` is injectable for tests.
 */
export function readEvalResults(path?: string): EvalResults | null {
  try {
    // The default path is inlined (statically scoped to evals/) so the bundler's
    // file tracer includes just results.json, not the whole project. The `path`
    // override is for tests only, which run outside the bundler.
    const raw =
      path !== undefined
        ? readFileSync(path, "utf8")
        : readFileSync(join(process.cwd(), "evals", "results.json"), "utf8");
    return parseEvalResults(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Render model for the footer — always honest about what is and isn't known. */
export interface FooterView {
  /** True only when results exist, every case passed, and zero hallucinations. */
  verified: boolean;
  /** True when a results artifact was found and parsed at all. */
  present: boolean;
  passed: number | null;
  total: number | null;
  /** evidenceCitationRate rendered as a whole-number percent. */
  citePct: number | null;
  hallucinationCount: number | null;
  generatedAt: string | null;
}

export function footerView(results: EvalResults | null): FooterView {
  if (results === null) {
    return {
      verified: false,
      present: false,
      passed: null,
      total: null,
      citePct: null,
      hallucinationCount: null,
      generatedAt: null,
    };
  }
  return {
    verified:
      results.total > 0 &&
      results.passed === results.total &&
      results.hallucinationCount === 0,
    present: true,
    passed: results.passed,
    total: results.total,
    citePct: Math.round(results.evidenceCitationRate * 100),
    hallucinationCount: results.hallucinationCount,
    generatedAt: results.generatedAt,
  };
}
