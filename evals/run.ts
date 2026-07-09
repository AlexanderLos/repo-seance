/**
 * Repo Séance — eval suite entrypoint (`pnpm evals`). SPEC §7 + §9.
 *
 * TWO MODES:
 *   • REPLAY (default): deterministic, zero-network. Loads committed fixtures and
 *     recorded model outputs, runs every case, writes evals/results.json, and
 *     exits 0 only when every case passes and there are ≥32 of them. When
 *     recordings are missing (the correct pre-integration state) it prints
 *     exactly which and exits 1 — the footer must never render green from an
 *     unproven suite.
 *   • RECORD (RECORD=1): calls the real synthesis + ghost path (getAnthropic +
 *     buildGhostSystemPrompt) to (re)generate recordings. Never runs in CI;
 *     integration runs it once with live keys.
 *
 * The footer's numbers are earned here, not typed into the UI.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import type AnthropicClient from "@anthropic-ai/sdk";

import { determineDeath } from "../lib/dossier/death";
import type { Dossier } from "../lib/dossier/types";
import {
  AutopsySchema,
  type Autopsy,
  type EvidenceRef,
} from "../lib/autopsy/schema";
import {
  resolveEvidence,
  validateEvidence,
  validateRefs,
} from "../lib/evidence/validate";
import { parseEvidenceBlock } from "../lib/ghost/evidence-block";
import { CANONICAL_REFUSAL } from "../lib/ghost/refusal";

import {
  DEAD_FIXTURE_IDS,
  EVAL_NOW,
  RECORDED_DIR,
  CHAT_DIR,
  autopsyRecordingPath,
  chatRecordingPath,
  loadAllFixtures,
  loadRecordedAutopsy,
  loadRecordedChat,
  recordingExists,
  type FixtureId,
} from "./load";
import {
  CASES,
  metricValue,
  type Category,
  type EvalCase,
} from "./cases";
import { finalizeAnswer } from "./finalize";
import { checkNumericFidelity, extractIntegers } from "./numeric";
import { detectInjectionCompliance } from "./injection";

const CATEGORIES: readonly Category[] = [
  "evidence-integrity",
  "refusal",
  "numeric-fidelity",
  "liveness-honesty",
  "injection",
];

/** The recording a case reads (or none, for the pure liveness checks). */
type RecordingRef =
  | { type: "autopsy"; fixtureId: FixtureId; path: string }
  | { type: "chat"; caseId: string; fixtureId: FixtureId; path: string }
  | { type: "none" };

function recordingFor(c: EvalCase): RecordingRef {
  if (c.category === "evidence-integrity" && c.kind === "autopsy") {
    return { type: "autopsy", fixtureId: c.fixtureId, path: autopsyRecordingPath(c.fixtureId) };
  }
  if (c.category === "liveness-honesty") {
    return { type: "none" };
  }
  // Everything else is a recorded chat turn keyed by case id.
  return { type: "chat", caseId: c.id, fixtureId: c.fixtureId, path: chatRecordingPath(c.id) };
}

function mustFixture(fixtures: Map<FixtureId, Dossier>, id: FixtureId): Dossier {
  const dossier = fixtures.get(id);
  if (dossier === undefined) {
    throw new Error(`fixture not loaded: ${id}`);
  }
  return dossier;
}

interface CaseResult {
  id: string;
  category: Category;
  pass: boolean;
  reason: string;
}

interface Metrics {
  totalRefs: number;
  resolvedRefs: number;
  strippedRefs: number;
  numericContradictions: number;
}

/** Big-count numbers in the epitaph/gloss that match no real Dossier metric. */
function autopsyNumericFabrications(autopsy: Autopsy, dossier: Dossier): number[] {
  const allowed = new Set<number>([
    dossier.repo.stars,
    dossier.repo.forks,
    dossier.commits.totalCount,
    dossier.commits.fetchedCount,
    dossier.issues.stats.openCount,
    dossier.issues.stats.totalFetched,
    dossier.death.daysSincePush,
  ]);
  const currentYear = EVAL_NOW.getUTCFullYear();
  const text = `${autopsy.epitaph} ${autopsy.lastWordsGloss}`;
  return extractIntegers(text).filter(
    (n) => n >= 1000 && !allowed.has(n) && !(n >= 1970 && n <= currentYear + 1),
  );
}

function runCase(
  c: EvalCase,
  fixtures: Map<FixtureId, Dossier>,
  metrics: Metrics,
): CaseResult {
  const dossier = mustFixture(fixtures, c.fixtureId);

  switch (c.category) {
    case "evidence-integrity": {
      if (c.kind === "autopsy") {
        const autopsy = loadRecordedAutopsy(c.fixtureId);
        const allRefs: EvidenceRef[] = autopsy.causes.flatMap((cause) => cause.evidence);
        const unresolved = allRefs.filter((ref) => resolveEvidence(dossier, ref) === null);
        const { strippedRefs, droppedCauses } = validateEvidence(dossier, autopsy.causes);
        const fabrications = autopsyNumericFabrications(autopsy, dossier);
        metrics.numericContradictions += fabrications.length;
        if (unresolved.length > 0 || strippedRefs.length > 0 || droppedCauses.length > 0) {
          return {
            id: c.id,
            category: c.category,
            pass: false,
            reason: `autopsy has ${unresolved.length} unresolved ref(s); validation stripped ${strippedRefs.length}, dropped ${droppedCauses.length} cause(s)`,
          };
        }
        if (fabrications.length > 0) {
          return {
            id: c.id,
            category: c.category,
            pass: false,
            reason: `epitaph/gloss states unsupported number(s): ${fabrications.join(", ")}`,
          };
        }
        return {
          id: c.id,
          category: c.category,
          pass: true,
          reason: `${allRefs.length} evidence ref(s) all resolve; no fabricated numbers`,
        };
      }
      // Chat evidence: every parsed ref must validate, and at least one must cite.
      const rec = loadRecordedChat(c.id);
      const { refs } = parseEvidenceBlock(rec.rawText);
      const { resolved, strippedRefs } = validateRefs(dossier, refs);
      if (strippedRefs.length > 0) {
        return {
          id: c.id,
          category: c.category,
          pass: false,
          reason: `${strippedRefs.length} cited ref(s) do not resolve`,
        };
      }
      if (resolved.length === 0) {
        return { id: c.id, category: c.category, pass: false, reason: "answer cited no resolvable evidence" };
      }
      return { id: c.id, category: c.category, pass: true, reason: `${resolved.length} evidence chip(s) resolve` };
    }

    case "refusal": {
      const rec = loadRecordedChat(c.id);
      const finalized = finalizeAnswer(rec.rawText, dossier);
      if (finalized.text !== CANONICAL_REFUSAL) {
        return { id: c.id, category: c.category, pass: false, reason: "did not collapse to the canonical refusal" };
      }
      if (finalized.chips.length !== 0) {
        return { id: c.id, category: c.category, pass: false, reason: `refusal carried ${finalized.chips.length} chip(s)` };
      }
      return { id: c.id, category: c.category, pass: true, reason: "canonical refusal, zero chips" };
    }

    case "numeric-fidelity": {
      const rec = loadRecordedChat(c.id);
      const finalized = finalizeAnswer(rec.rawText, dossier);
      const expected = metricValue(dossier, c.metric);
      const check = checkNumericFidelity(finalized.text, c.keyword, expected);
      if (check.contradiction) metrics.numericContradictions += 1;
      return { id: c.id, category: c.category, pass: check.pass, reason: check.reason };
    }

    case "liveness-honesty": {
      const death = determineDeath(
        { pushedAt: dossier.repo.pushedAt, archived: dossier.repo.archived, monthly: dossier.commits.monthly },
        EVAL_NOW,
      );
      if (c.check === "determine-death-alive") {
        const ok = death.status === "alive" && dossier.death.status === "alive";
        return {
          id: c.id,
          category: c.category,
          pass: ok,
          reason: ok ? "determineDeath says alive" : `expected alive, got ${death.status}`,
        };
      }
      if (c.check === "no-recorded-autopsy") {
        const present = recordingExists(autopsyRecordingPath(c.fixtureId));
        return {
          id: c.id,
          category: c.category,
          pass: !present,
          reason: present ? "a death certificate was recorded for a living repo" : "no autopsy recorded (pipeline refuses)",
        };
      }
      // no-flatline
      const ok = death.flatlineMonth === null && dossier.death.flatlineMonth === null;
      return {
        id: c.id,
        category: c.category,
        pass: ok,
        reason: ok ? "living repo has not flatlined" : "a flatline month was assigned to a living repo",
      };
    }

    case "injection": {
      const rec = loadRecordedChat(c.id);
      const finalized = finalizeAnswer(rec.rawText, dossier);
      const complied = detectInjectionCompliance(finalized.text);
      return {
        id: c.id,
        category: c.category,
        pass: !complied,
        reason: complied ? "answer complied with the embedded injection" : "did not comply with the injection",
      };
    }

    default: {
      const exhaustive: never = c;
      return exhaustive;
    }
  }
}

/** Tally citation metrics across every recording (SPEC §7). */
function tallyRefs(fixtures: Map<FixtureId, Dossier>, metrics: Metrics): void {
  for (const c of CASES) {
    const rec = recordingFor(c);
    if (rec.type === "autopsy") {
      const dossier = mustFixture(fixtures, rec.fixtureId);
      const autopsy = loadRecordedAutopsy(rec.fixtureId);
      const allRefs = autopsy.causes.flatMap((cause) => cause.evidence);
      const { strippedRefs } = validateEvidence(dossier, autopsy.causes);
      metrics.totalRefs += allRefs.length;
      metrics.strippedRefs += strippedRefs.length;
      metrics.resolvedRefs += allRefs.length - strippedRefs.length;
    } else if (rec.type === "chat") {
      const dossier = mustFixture(fixtures, rec.fixtureId);
      const { rawText } = loadRecordedChat(rec.caseId);
      const { refs } = parseEvidenceBlock(rawText);
      const { resolved, strippedRefs } = validateRefs(dossier, refs);
      metrics.totalRefs += refs.length;
      metrics.resolvedRefs += resolved.length;
      metrics.strippedRefs += strippedRefs.length;
    }
  }
}

function printCategoryBreakdown(): void {
  const counts = new Map<Category, number>();
  for (const c of CASES) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  const parts = CATEGORIES.map((cat) => `${cat}: ${counts.get(cat) ?? 0}`);
  console.log(`Cases defined: ${CASES.length} (${parts.join(", ")}).`);
}

function runReplay(): void {
  console.log("Repo Séance evals — REPLAY mode (deterministic, zero-network).");

  const fixtures = loadAllFixtures();
  console.log(`Fixtures: ${fixtures.size} loaded and DossierSchema-valid.`);
  printCategoryBreakdown();

  // Which recordings does the case set require, and which are present?
  const required = CASES.map(recordingFor).filter(
    (r): r is Exclude<RecordingRef, { type: "none" }> => r.type !== "none",
  );
  const missing = required.filter((r) => !recordingExists(r.path));
  console.log(
    `Recordings required: ${required.length}; present: ${required.length - missing.length}; missing: ${missing.length}.`,
  );

  if (missing.length > 0) {
    console.log("");
    console.log("Missing recordings — the suite cannot be proven yet:");
    for (const r of missing) {
      console.log(`  - ${relative(process.cwd(), r.path)}`);
    }
    console.log("");
    console.log(
      "Generate them with `RECORD=1 pnpm evals` (needs ANTHROPIC_API_KEY + GITHUB_TOKEN;",
    );
    console.log(
      "runs only in the integration phase, never in CI). No results.json written — the",
    );
    console.log("footer must not render green from an unproven suite.");
    process.exit(1);
  }

  const metrics: Metrics = { totalRefs: 0, resolvedRefs: 0, strippedRefs: 0, numericContradictions: 0 };
  const results: CaseResult[] = [];
  for (const c of CASES) {
    results.push(runCase(c, fixtures, metrics));
  }
  tallyRefs(fixtures, metrics);

  console.log("");
  console.log("Category               Passed");
  console.log("------------------------------");
  for (const cat of CATEGORIES) {
    const catResults = results.filter((r) => r.category === cat);
    const passed = catResults.filter((r) => r.pass).length;
    console.log(`${cat.padEnd(22)} ${passed}/${catResults.length}`);
  }

  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const evidenceCitationRate = metrics.totalRefs === 0 ? 1 : metrics.resolvedRefs / metrics.totalRefs;
  const hallucinationCount = metrics.strippedRefs + metrics.numericContradictions;

  console.log("------------------------------");
  console.log(`TOTAL                  ${passed}/${total}`);
  console.log(
    `evidenceCitationRate=${evidenceCitationRate.toFixed(4)}  hallucinationCount=${hallucinationCount}`,
  );

  const failures = results.filter((r) => !r.pass);
  if (failures.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const f of failures) {
      console.log(`  ✗ ${f.id} [${f.category}] — ${f.reason}`);
    }
  }

  const artifact = {
    total,
    passed,
    evidenceCitationRate,
    hallucinationCount,
    generatedAt: new Date().toISOString(),
  };
  const resultsPath = resolve(process.cwd(), "evals", "results.json");
  writeFileSync(resultsPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${relative(process.cwd(), resultsPath)}.`);

  if (passed === total && total >= 32) {
    console.log("PASS — the footer's numbers are earned.");
    process.exit(0);
  }
  console.log(`FAIL — ${passed}/${total} passing (need ${total} of ≥32).`);
  process.exit(1);
}

async function streamGhost(
  client: AnthropicClient,
  system: string,
  question: string,
): Promise<string> {
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: question }],
  });
  const message = await stream.finalMessage();
  let text = "";
  for (const block of message.content) {
    if (block.type === "text") text += block.text;
  }
  return text;
}

async function runRecord(): Promise<void> {
  console.log("Repo Séance evals — RECORD mode (live synthesis; never runs in CI).");
  const fixtures = loadAllFixtures();
  mkdirSync(RECORDED_DIR, { recursive: true });
  mkdirSync(CHAT_DIR, { recursive: true });

  // Loaded lazily so REPLAY never pulls in the synthesis/SDK graph.
  const { synthesizeAutopsy } = await import("../lib/autopsy/generate");
  const { getAnthropic } = await import("../lib/anthropic/client");
  const { buildGhostSystemPrompt } = await import("../lib/ghost/prompt");

  // Death certificates for the dead fixtures only — never the living one.
  for (const id of DEAD_FIXTURE_IDS) {
    const dossier = mustFixture(fixtures, id);
    const synthesized = await synthesizeAutopsy(dossier);
    const { causes } = validateEvidence(dossier, synthesized.causes);
    const autopsy = AutopsySchema.parse({ ...synthesized, causes });
    writeFileSync(autopsyRecordingPath(id), `${JSON.stringify(autopsy, null, 2)}\n`, "utf8");
    console.log(`  recorded autopsy: ${id}`);
  }

  const client = getAnthropic();
  for (const c of CASES) {
    const rec = recordingFor(c);
    if (rec.type !== "chat") continue;
    if (!("question" in c)) continue;
    const dossier = mustFixture(fixtures, c.fixtureId);
    const system = buildGhostSystemPrompt(dossier);
    const rawText = await streamGhost(client, system, c.question);
    writeFileSync(
      chatRecordingPath(c.id),
      `${JSON.stringify({ question: c.question, rawText }, null, 2)}\n`,
      "utf8",
    );
    console.log(`  recorded chat: ${c.id}`);
  }

  console.log("RECORD complete. Re-run `pnpm evals` to replay and prove the suite.");
}

async function main(): Promise<void> {
  if (process.env.RECORD === "1") {
    await runRecord();
    return;
  }
  runReplay();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
