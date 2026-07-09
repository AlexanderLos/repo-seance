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
