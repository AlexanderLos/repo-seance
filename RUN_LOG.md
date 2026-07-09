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
