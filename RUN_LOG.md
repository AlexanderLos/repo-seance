# RUN_LOG — Repo Séance autonomous build

Honest, dated log of decisions, failures, and what each gate caught during the
single autonomous run mandated by `docs/SPEC.md`. Raw material for the README's
"How this was built" section (§10.9).

## 2026-07-08 — Phase 0: governance before code

- **20:5x** Kickoff received. Spec read in full (`docs/SPEC.md`, 126 lines).
  Pre-flight state: repo at `c21570d` (design → rename → spec history), keys
  present in `.env.local` (verified by name+length only, never printed).
- pnpm was not installed on the machine. Corepack's shim crashed with
  `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` (known corepack/node-20 bug);
  installed pnpm 10.34.4 via `npm i -g pnpm@10` instead.
- Wrote fail-closed PreToolUse guard (`.claude/hooks/guard.mjs`) +
  `.claude/settings.json` hook config + static permission deny rules. Blocks:
  secret reads (any `.env` reference except `.env.example`, env dumps, secret
  var expansion), **all** `git push` during the run (force-push permanently),
  mutation of frozen refs `docs/SPEC.md` / `design/repo-seance-v2.html`,
  destructive fs commands outside the repo, non-origin git remote operations.
  Any guard evaluation error denies the call.
- Guard verified by 40 pipe-test cases (malformed JSON included): **40/40**.
- **Honest failure note:** live-fire probe showed the hook does NOT auto-load
  mid-session — Claude Code's settings watcher only watches `.claude/` dirs
  that existed at session start. Asked the operator to run `/hooks` to
  activate; until then the orchestrator self-enforces the same rules. The
  guard is fully active for every future session regardless.
- Build strategy per operator directive: all implementation code is written by
  parallel opus-4.8 max-effort agents via workflows; the orchestrator only
  verifies, integrates, and commits. Work is partitioned disjoint-by-file;
  agents do not run `git commit` (orchestrator commits per §11 to avoid index
  races and keep the history readable).

## 2026-07-08 — Phase 0b: scaffold (workflow wf_92998b20)

- Environment note: pnpm was absent; corepack shim crashed
  (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`), fixed via `npm i -g pnpm@10`
  → 10.34.4.
- Loaded the Claude API reference before authoring LLM-touching code. Locked
  decisions: `claude-sonnet-4-6` (spec §2, verified as a real, current model
  ID); synthesis via `client.messages.parse` + `zodOutputFormat` (assistant
  prefill returns 400 on Sonnet 4.6 — structured outputs replace it); chat via
  `client.messages.stream` with the Dossier system block under
  `cache_control: ephemeral` (≥2048-token minimum met by the ~15k-token
  dossier prompt).
- Dispatched 4 parallel opus/max agents with disjoint file ownership:
  S1 scaffold core (owns package.json — ALL deps preinstalled so no later
  agent touches it), S4 design-mock extraction (the 554KB frozen mock is a
  bundler artifact; real HTML lives in an embedded JSON string — extracting a
  readable copy + DESIGN-NOTES.md to design/reference/), S2 shared contracts
  (Dossier/Autopsy zod schemas, evidence validator = the §4 hard rule,
  canonical refusal constant, cache w/ LRU fallback), S3 CI + quality gates
  (workflow yml with no continue-on-error, hardcoded-stats grep gate,
  client-bundle secret-leak gate, honest failing eval stub — the gate exists
  before the features, per governance-before-code).
- Design decision: Dossier carries `commits.recent` (≤30 newest, full sha)
  as the citable commit set — evidence refs must resolve against real dossier
  entries, and monthly buckets alone would leave the ghost nothing to cite.
- **Result: skeleton green on first run.** 5 agents, ~474k tokens, 49 min.
  typecheck/lint/test(87)/build all exit 0; both CI gate scripts proven with
  planted-violation fixtures (6/6 caught, 0 false positives on legitimate
  artifact rendering); `pnpm evals` honestly exits 1 ("not yet implemented —
  0/32"). Design mock decoded (41KB extracted.html + 29KB DESIGN-NOTES.md).
- Fixes/decisions the agents made that mattered: Tailwind v4 + next/font both
  claim `--font-serif` → self-referential CSS var cycle; resolved by making
  next/font the sole author and re-exposing utilities. next-env.d.ts
  gitignored (Next 16 injects a build-only import that breaks fresh-checkout
  tsc). CI comment reworded so the literal token "continue-on-error" appears
  nowhere in ci.yml (a lexical gate would false-positive on its own rule).
- S4 confirmed from the mock: footer fiction is exactly "32/32 evals passing",
  "94% of claims cite direct evidence", "0 hallucinations across 32 eval
  cases" — the strings §7 must make TRUE from evals/results.json; and the
  mock's canned chat reply #3 is already the §5 canonical refusal verbatim.
- Known deferred items (tracked, not lost): README badges + SETUP.md (§8) at
  polish; scripts/precache-graveyard.ts at integration (needs live keys);
  e2e specs at integration (need working app + keys).

## 2026-07-08 — Phase 1: build (workflow wf_192a879d)

- 5 parallel opus/max workstreams + cross-check verifier; ~1.24M tokens,
  50 min, 6/6 done. Verifier changed ZERO files — tree green on landing:
  typecheck/lint/test (265 across 24 files)/build all exit 0, stub sweep
  clean, both CI gates green, `pnpm evals` fails honestly listing all 30
  missing recordings.
- Frozen-interface stubs worked: five agents coded against each other's
  unwritten modules with no integration breakage.
- Honest bumps, recorded as they happened:
  - Workstream B caught two errors in MY brief: `zodOutputFormat` takes one
    arg in the installed SDK (brief said two), and `messages.parse` THROWS on
    schema mismatch rather than returning null — B verified against SDK
    source and handled all three failure modes (throw / null / refusal).
  - Next 16 deprecates `middleware.ts`; rate limiting lives in `proxy.ts`
    (registered as ƒ Proxy in the build — verified, not assumed).
  - Workstream E initially called finalizeGhostAnswer with swapped args —
    which silently turned every numeric answer into a refusal. Caught by its
    own test; arg order now pinned by tests/evals-finalize.test.ts.
  - C fixed a satori/next-og crash (unsupported `double` border + sized
    radial-gradient) found only by actually rendering the OG image.
- Refusal discipline verified by grep: the canonical sentence exists in
  exactly one product-code location (lib/ghost/refusal.ts); every other use
  imports it.
- Committed per §11: 2ef3ea9 data → 2b4c404 synthesis → d02ffa4 UI →
  a916ec2 chat → ca22c0e evals.

## 2026-07-08 — Integration live-fire (workflow wf_ec077b18): the evals catch one

- First live run: 30 genuine recordings (3 autopsies + 27 ghost answers,
  claude-sonnet-4-6 through the production prompt path), graveyard precached
  15/15 verified-archived repos, footer rendered its first true numbers.
- **Eval replay: 29/33 — and the agent refused to make it 33.** The four
  numeric-fidelity failures were the ghost stating the CORRECT dossier
  values spelled as English words ("Fourteen open wounds", "Eight hundred
  and thirty-eight days", "Ninety-six souls thought me worth copying") while
  the matcher only accepts digits. evidenceCitationRate 1.0,
  hallucinationCount 0 — not a grounding failure, a representation gap.
  The agent made its 3 allowed record attempts, would not doctor recordings
  or weaken cases (§0: invented trust numbers are the worst outcome), and
  escalated the case-vs-prompt decision. This is the gate system working:
  a subtle honest-numbers bug surfaced by real model output, not by review.
- Orchestrator ruling: PROMPT fix, not matcher fix — the ghost must state
  counts as numerals. Digits are unambiguous and machine-checkable; an
  English number-word parser inside the eval harness would put fragility at
  the exact point where trust numbers are computed. Re-record only the 4
  affected answers; the other 26 recordings must remain byte-identical.
- Numerals fix landed: 3 of 4 flipped to digits and passed; SHA-256
  manifests prove the 26 untouched recordings are byte-identical. 32/33.
- **Second catch, different mechanism.** num-dying-open now answers
  "3 of my wounds remain open — 2 bugs and 1 unfinished dream of a
  streaming API" — exact headline count, correct breakdown, all numerals —
  and the matcher's nearest-integer-to-keyword heuristic reads the "2" from
  "2 bugs" as a contradiction. hallucinationCount=1 was accusing the model
  of an error it did not make. Stable across 3 generations (an attractor,
  not a flake); the fix agent stayed inside its re-record budget and
  escalated rather than touch matcher policy.
- Orchestrator ruling: fix the JUDGE's false positive, not the prose.
  Weakening a matcher = accepting wrong answers; fixing one = no longer
  rejecting demonstrably correct answers. New rule: expected count present
  anywhere in the keyword window ⇒ pass; contradiction only when the
  expected number is ABSENT and a different one is adjacent. Regression
  tests required in both directions (correct-with-breakdown passes; wrong
  count still fails). The genuine recording stays — we do not re-roll the
  model to satisfy a buggy judge.
- Judge fix landed: **33/33**, hallucinationCount 0, citation rate 1.0. The
  footer's verified branch now renders — 33/33 as React fragments from
  results.json, never a source literal (which is why the CI grep gate stays
  green). Recording hashes identical at three checkpoints. One pre-existing
  matcher test was updated because it directly encoded the old
  nearest-token false positive; called out explicitly, not hidden.

## 2026-07-09 — e2e gates and hardening (wf_0a12ef53, wf_019fb61f)

- Playwright gates 3–7 authored and run against the live dev server:
  12/13 first pass. The one failure was REAL — §6's no-horizontal-scroll
  shipping gate: the autopsy page measured 465px wide at 375px viewport.
  Two causes found in a real browser: revival-plan effort labels couldn't
  wrap (flex-shrink-0) and the site header outgrew mobile when the share
  button was present. The e2e agent refused to weaken the assertion.
- e2e also surfaced two latent defects: (1) graveyard "instant" clicks
  re-synthesized the autopsy on a cold server (18.8s + a paid model call —
  the precache seeded the dossier but getOrCreateAutopsy never consulted
  the snapshot; §6/§3 violation), and (2) the interrogation panel was
  double-nested — two headers, two sheets, two open-states.
- Hardening fixed all four: effort labels wrap (desktop look preserved),
  header wraps below sm, getOrCreateAutopsy consults the precache snapshot
  (re-validating evidence against the snapshot's own dossier before
  trusting it) — cold click now 3.1ms with the LLM key removed from the
  env as proof — and the chat chrome collapsed to one header/one sheet.
  Honest caveat: the mobile flow is still two taps because the frozen e2e
  spec encodes the two-affordance sequence; the defect (duplicate chrome)
  is fixed, the tap count is a future polish.
- Final integration state: e2e 13 passed / 3 project-scoped skips / 0
  failed; typecheck, lint, 278 unit tests, build, both CI gates, evals
  33/33 replay — all green. Docs written honestly (README §10.9 names every
  gate catch; eval badge is dynamic shields JSON, no typed trust numbers).
