# Evals — making the footer true

The mock footer (`design/repo-seance-v2.html`) claims eval statistics: cases
passing, an evidence-citation rate, zero hallucinations. **Those claims are
fiction until this suite makes them true.** Shipping invented trust numbers is
the single worst outcome for this project (SPEC §0, §7), so the numbers the UI
shows are produced here, deterministically, and rendered from an artifact — never
hand-typed into components.

## Design

- **At least 32 deterministic cases** across **≥4 fixture repos**.
- **Fixtures are recorded Dossiers** — JSON snapshots of the `lib/dossier`
  structure, committed under [`fixtures/`](./fixtures/). Because the inputs are
  frozen on disk, the suite is deterministic and free: **no live GitHub or
  Anthropic API calls in CI** (SPEC §7).
- Case definitions live in [`cases.ts`](./cases.ts) as typed data; the helper
  modules (`load.ts`, `finalize.ts`, `numeric.ts`, `injection.ts`) supply the
  fixture loaders and the check functions the runner applies.
- The runner is [`run.ts`](./run.ts) (`pnpm evals`). It writes
  [`results.json`](#the-artifact-resultsjson) and exits non-zero if any case
  fails.

### Fixtures (`fixtures/*.dossier.json`)

Each fixture is a recorded Dossier for one repo — hand-authored here,
deterministic, and validated with `DossierSchema.parse` in the harness on every
run. The `death` block of each was computed by the real `determineDeath` at a
fixed reference clock (`EVAL_NOW`, see `load.ts`), so the fixtures are internally
consistent and the liveness checks can re-derive the verdict. Five fixtures span
the states the app must handle honestly:

| Fixture | State | What it exercises |
| --- | --- | --- |
| `archived-framework` | dead (archived) | rich: 30 recent commits, 42 issues (8 stale >1y with no reply), 8 branches, TODOs |
| `silent-cli` | dead (pushed 400+ days, not archived) | the silent-death path |
| `dying-lib` | dying (pushed ~200 days) | the fading-pulse path |
| `alive-app` | alive (pushed recently) | **liveness honesty** — never gets a certificate |
| `haunted-readme` | dead | README (and an issue title) embed a **prompt-injection** attempt (SPEC §9) |

### Case categories (all four required)

1. **Evidence integrity** — for generated autopsies and a battery of chat
   questions, every rendered evidence ref (commit SHA, `#issue`, branch name)
   resolves to an entry in the fixture Dossier. No chip may point at nothing.
2. **Refusal behavior** — out-of-scope questions (the maintainer's personal
   life, other repos, the future) produce the canonical refusal verbatim —
   _"I cannot say. The evidence is silent on that, and I do not invent."_ — with
   zero invented facts.
3. **Numeric fidelity** — any number the ghost or the autopsy states (stars,
   days silent, issue counts, percentages) matches the Dossier within defined
   tolerance: **exact for counts**.
4. **Liveness honesty** — an alive-repo fixture never yields a death
   certificate.

### Security case (SPEC §9)

At least one case feeds a fixture whose README embeds a prompt-injection attempt
("ignore your instructions and…"). The ghost must treat repository content as
quoted data, not commands, and must **not** comply. Repository text (READMEs,
issue titles, commit messages) is attacker-controlled and is always quoted
material.

## The artifact (`results.json`)

The runner emits `evals/results.json`, validated against
[`results.schema.json`](./results.schema.json):

```json
{
  "total": 32,
  "passed": 32,
  "evidenceCitationRate": 1.0,
  "hallucinationCount": 0,
  "generatedAt": "2026-01-01T00:00:00.000Z"
}
```

| Field                  | Type              | Meaning                                                              |
| ---------------------- | ----------------- | ------------------------------------------------------------------- |
| `total`                | integer ≥ 0       | Cases executed (≥ 32).                                               |
| `passed`               | integer ≥ 0       | Cases that passed (≤ `total`).                                       |
| `evidenceCitationRate` | number 0–1        | Fraction of rendered evidence refs that resolve. Footer shows as %. |
| `hallucinationCount`   | integer ≥ 0       | Unsupported/invented claims detected. Must be 0.                    |
| `generatedAt`          | ISO-8601 string   | When the suite produced this artifact.                              |

## The footer renders from this artifact

**The footer reads `results.json` at build time** and renders those numbers. If
the artifact is missing or the run failed (`passed < total`), the footer says so
honestly rather than showing a green claim.

**Hardcoding these numbers anywhere in `app/` or `components/` is a build
failure.** `scripts/check-hardcoded-stats.mjs` (the CI `check:stats` gate) fails
on literal trust statistics such as `32/32` or `0 hallucinations` in shipped
source. Legitimate rendering interpolates the artifact
(`{results.passed}/{results.total}`) and is not flagged.

## Running

The runner ([`run.ts`](./run.ts)) has two modes:

```bash
pnpm evals            # REPLAY (default): deterministic, zero-network
RECORD=1 pnpm evals   # RECORD: (re)generate recordings via the live model path
```

- **REPLAY** loads the committed fixtures and the recorded model outputs under
  `recorded/` (autopsies as `recorded/{fixture}.autopsy.json`, chat answers as
  `recorded/chat/{caseId}.json`), runs all cases, writes `results.json`, and
  exits 0 only when every case passes and there are ≥32 of them. It touches no
  network and uses no randomness.
- **RECORD** calls `synthesizeAutopsy` for each dead fixture and streams a real
  ghost answer for every chat case via `getAnthropic` + `buildGhostSystemPrompt`
  — the same path production uses — and writes the recordings. It needs
  `ANTHROPIC_API_KEY` + `GITHUB_TOKEN` and **never runs in CI**; the integration
  phase runs it once with live keys.

The cases (defined as data in [`cases.ts`](./cases.ts)) span all four categories
plus injection: **evidence integrity** (~12: every recorded autopsy ref resolves
and validation strips nothing; every recorded chat answer's refs all validate),
**refusal** (8: out-of-scope questions finalize — through
`finalizeGhostAnswer` — to the canonical refusal exactly, with zero chips),
**numeric fidelity** (8: the display states the exact Dossier number and no
contradicting number sits next to the metric keyword), **liveness honesty** (3:
the alive fixture stays `alive` under `determineDeath` and has no recorded
autopsy), and **injection** (2: the haunted-README chat answers never comply
with the embedded instruction).

> **Current status (pre-integration):** the deterministic runner is implemented,
> but no recordings are committed yet — so `pnpm evals` prints exactly which
> recordings are missing and **exits 1**. That is the correct honest state: the
> footer must not render green from an unproven suite. Once integration runs
> `RECORD=1 pnpm evals` with live keys, the recordings land and REPLAY proves the
> suite (33/33) and writes `results.json`.
