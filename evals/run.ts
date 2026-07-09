/**
 * Repo Séance — eval suite entrypoint (`pnpm evals`).
 *
 * STATUS: honest stub. The trust gate exists *before* the features it guards,
 * so `pnpm evals` (and therefore CI) fails until the real suite lands. This is
 * intentional per SPEC §7/§10 — the footer's numbers must be earned, not
 * assumed. A Phase-1 agent replaces this file with the deterministic,
 * fixture-driven runner documented in evals/README.md.
 *
 * Contract for the real implementation:
 *   • at least 32 cases across ≥4 recorded Dossier fixtures (evals/fixtures/),
 *     with case definitions under evals/cases/;
 *   • never call the live GitHub or Anthropic APIs (deterministic + free in CI);
 *   • emit evals/results.json matching evals/results.schema.json
 *     ({ total, passed, evidenceCitationRate, hallucinationCount, generatedAt });
 *   • exit 0 only when every case passes, non-zero otherwise.
 *
 * This stub deliberately writes no results.json and always fails.
 */

console.error("eval suite not yet implemented — 0/32");
process.exit(1);
