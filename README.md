# Repo Séance

**Forensics for dead code.** Paste an abandoned GitHub repository. Receive its death certificate. Speak with its ghost.

[![CI](https://github.com/AlexanderLos/repo-seance/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexanderLos/repo-seance/actions/workflows/ci.yml)
[![evals passing](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FAlexanderLos%2Frepo-seance%2Fmain%2Fevals%2Fresults.json&query=%24.passed&label=evals%20passing&color=brightgreen&cacheSeconds=3600)](https://github.com/AlexanderLos/repo-seance/blob/main/evals/results.json)

Both badges go live once this repository is pushed to GitHub. The CI badge is GitHub Actions; the eval badge is read straight from [`evals/results.json`](evals/results.json) — the pass count is never typed into this file, it is computed by the suite and rendered dynamically.

---

## What it is

An abandoned repository leaves a body. Repo Séance performs the autopsy.

Give it an `owner/repo` and it fetches everything GitHub still remembers, decides — deterministically — whether the project is dead, and then lets a grounded model narrate the remains. Three surfaces:

1. **Exhume** — the landing page. An `owner/repo` input, plus a curated **Graveyard** of famously dead repositories for instant, pre-cached demos.
2. **The Autopsy** (`/{owner}/{repo}`) — the death certificate. Vitals, a decline chart, cause of death (confidence-ranked, each claim linked to real evidence), last words (the final commit), unfinished business (branches, stale issues, TODOs), and a revival plan. Each autopsy also renders a shareable tombstone OG image.
3. **The Interrogation** — chat with the repository's ghost. First person, mournful, concise. Every answer carries evidence chips that resolve to real commits, issues, and files — and when the data cannot answer a question, the ghost refuses rather than invents.

A living repository is never given a death it did not earn: it gets its own page — *"This one still breathes."* — and an invitation to the Graveyard instead.

## How it works

The whole design exists to make one promise keepable: **nothing the ghost says is unsupported by the repository's own record.**

```
GitHub  ──►  Dossier  ──►  Death verdict  ──►  Grounded synthesis  ──►  Evidence validation  ──►  Autopsy
(server)     (one typed      (deterministic,     (one Claude call,        (walk every ref;          + Ghost chat
             structure)      not the model)      strict JSON)             strip what can't resolve)  (post-validated)
```

- **The Dossier.** All GitHub data is fetched server-side — metadata, commit history bucketed by month, branches, issues, the README, a TODO/FIXME scan — into a single typed structure. The Dossier is the *only* thing the model ever sees. Repository text (READMEs, issue titles, commit messages) is attacker-controlled, so it is treated as quoted data, never as instructions.
- **The death verdict is deterministic, not the model's opinion.** Archived or silent for over a year → **dead**; six months to a year → **dying**; otherwise → **alive**. The model narrates; it never decides who is dead.
- **Grounded synthesis.** One server-side call to Claude (`claude-sonnet-4-6`) turns the Dossier into strictly-validated JSON: an epitaph, confidence-ranked causes of death with evidence references, a revival plan, and the sardonic gloss under the final commit.
- **Evidence validation is enforced in code, not merely requested in the prompt.** After generation, every evidence reference is walked against the Dossier. A reference that doesn't resolve is stripped; a cause left with no valid evidence is dropped. The UI can only render a chip that points at a real commit, issue, or branch URL.
- **The ghost is post-validated the same way.** Chat answers stream, then their evidence block is checked against the Dossier. An answer whose references all fail is replaced by the canonical refusal — *"I cannot say. The evidence is silent on that, and I do not invent."* The refusal is a feature, and it is eval-tested.
- **Caches.** Dossiers and rendered autopsies are cached for 24h (Upstash Redis, with an in-memory LRU fallback so local dev needs no Redis), so repeat visits and Graveyard clicks cost zero API calls.
- **The evals gate the footer.** The footer's trust statistics are not typed by anyone; they are rendered at build time from `evals/results.json`. If that artifact is missing or the suite failed, the footer says so honestly instead of showing a green claim. See [Why the footer is trustworthy](#why-the-footer-is-trustworthy).

## How this was built

This repository was produced by a single autonomous build run against a frozen brief, [`docs/SPEC.md`](docs/SPEC.md), which was committed *before* the run began and never edited during it. The run was DONE only when every completion gate in that spec passed — "the agent believes it works" did not count.

The shape of it: **one Claude Code session acting as orchestrator, dispatching parallel Opus 4.8 max-effort agents** across disjoint, file-partitioned workstreams (scaffold → data layer → synthesis → UI → chat → evals → hardening). The orchestrator verified, integrated, and committed; the agents wrote the implementation against each other's frozen interfaces. The product's own model is Claude Sonnet 4.6 (`claude-sonnet-4-6`); the builders were Opus 4.8. The full, dated, honest history — including the parts that went wrong — lives in [`RUN_LOG.md`](RUN_LOG.md).

**Governance before code.** Before a line of the app was written, the run installed a fail-closed `PreToolUse` guard: no reading of secrets, no `git push`, no mutating the frozen spec or design files. It was verified against a battery of malformed-input cases. One honest caveat, recorded rather than hidden: the guard did **not** hot-load mid-session (Claude Code only watches `.claude/` directories that existed at session start), so the operator was asked to run `/hooks` to activate it, and the orchestrator self-enforced the same rules until then. The guard is fully active for every subsequent session.

**What the gates caught — by name.** The value of the harness is in the mistakes it refused to let through:

- **An SDK-arity error in the orchestrator's own brief.** The brief told an agent that `zodOutputFormat` took two arguments and that `messages.parse` returned `null` on a schema mismatch. Both were wrong; the agent checked the installed SDK, found `parse` *throws*, and handled every failure mode instead of the one the brief imagined.
- **A swapped-args bug that silently turned answers into refusals.** One workstream called `finalizeGhostAnswer` with its arguments transposed, which quietly converted every numeric answer into a refusal — a failure that looks like working software. Its own test caught it; the argument order is now pinned by a regression test.
- **A satori / Vercel-OG crash** in the tombstone image (an unsupported `double` border and a sized radial-gradient), found only by *actually rendering* the OG image rather than trusting that it compiled.
- **`middleware.ts` → `proxy.ts`.** Next.js 16 deprecates the middleware entry point; rate-limiting was moved to the proxy and verified as registered in the build, not assumed.
- **The numerals catch.** On the first live eval run, the ghost stated *correct* Dossier values but spelled as English words — "Fourteen open wounds", "Ninety-six souls thought me worth copying" — while the numeric matcher only accepted digits. Evidence citation was perfect and hallucinations were zero; it was a representation gap, not a grounding failure. The fix was to the **prompt** (the ghost must state counts as numerals, which are unambiguous and machine-checkable), not to the matcher — a number-word parser inside the eval harness would put fragility exactly where the trust numbers are computed. Only the four affected recordings were re-recorded; SHA-256 manifests proved the rest stayed byte-identical.
- **The matcher false-positive catch.** A later answer read *"3 of my wounds remain open — 2 bugs and 1 unfinished dream of a streaming API"* — the exact headline count, correctly broken down, all in numerals — and the judge's nearest-number heuristic read the "2" from "2 bugs" as a contradiction, accusing the model of an error it did not make. This time the fix was to the **judge**, not the prose: weakening a matcher means accepting wrong answers, but fixing a false positive means no longer rejecting demonstrably correct ones. New regression tests were required in *both* directions (a correct answer with a breakdown passes; a genuinely wrong count still fails), and the honest recording was left exactly as the model produced it.

Underlying both eval catches is one principle the run held to: **the recordings are never doctored, and cases are never weakened, to turn a number green.** Shipping invented trust statistics would be the single worst outcome for this project, so when the model's real output disagreed with the harness, the harness was fixed or the prompt was fixed — the recording was never re-rolled to flatter a buggy judge.

### Why the footer is trustworthy

The footer claims a pass count, an evidence-citation rate, and a hallucination count. Those numbers are made true by [`evals/`](evals/), a **record/replay** suite:

- **Fixtures are recorded Dossiers** — JSON snapshots frozen on disk — spanning every state the app must handle honestly: archived-dead, silently-dead, dying, alive, and a "haunted" README carrying a prompt-injection attempt.
- **Cases span the four required categories** — evidence integrity, refusal behavior, numeric fidelity, and liveness honesty — plus a prompt-injection case in which the ghost must treat repository text as quoted data and refuse to comply.
- **Replay is deterministic and free.** `pnpm evals` loads the fixtures and the committed model recordings and re-checks every case with no network and no randomness. `RECORD=1` regenerates the recordings through the *same* production code path the live app uses, so what the suite proves is what ships.
- **The footer renders from the artifact the suite emits.** No component hard-codes a statistic; a CI grep gate fails the build if one ever does.

The result: the numbers on the site and on the badge above cannot drift from what the suite can actually prove.

## Local setup

Prerequisites: **Node 20** and **pnpm 10**.

1. **Install dependencies.**
   ```bash
   pnpm install
   ```
2. **Create your local env file** from the template and fill in the keys (see [Environment variables](#environment-variables)):
   ```bash
   cp .env.example .env.local
   ```
   `.env.local` is git-ignored and is loaded implicitly — never print, echo, or commit it. `pnpm dev` and `pnpm build` pick it up through Next.js; the record and precache scripts load it via `node --env-file`.
3. **Run the app.**
   ```bash
   pnpm dev            # http://localhost:3000
   ```
   With no Upstash keys, the cache and rate-limiter fall back to in-memory — the app runs fully local.
4. **Run the evals (deterministic, offline).**
   ```bash
   pnpm evals          # replay: loads fixtures + recordings, writes evals/results.json
   ```
5. **Re-record the evals (live keys, spends budget).** Only needed when a prompt or the synthesis path changes:
   ```bash
   pnpm evals:record   # regenerates recordings through the production model path
   ```
6. **Run the end-to-end gates** (Playwright — the five gate specs in [`e2e/`](e2e/) covering the autopsy, the ghost chat, liveness honesty, responsiveness, and the share image, run at desktop 1440 + mobile 375; boots a dev server automatically):
   ```bash
   pnpm e2e
   ```
7. **Pre-cache the Graveyard** so demo clicks are instant (live keys, spends budget):
   ```bash
   pnpm precache
   ```

Quality gates, the same ones CI runs on every push:

```bash
pnpm typecheck        # tsc --noEmit, strict
pnpm lint
pnpm test             # Vitest unit suite
pnpm build            # must build with no secrets present
pnpm check:stats      # fails on any hard-coded trust statistic in the UI
pnpm check:secrets    # fails if a token name or value reached the client bundle
```

## Environment variables

Names and purpose only — this file never contains a value. See [`.env.example`](.env.example) for the copy-in template.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | **Required** | Server-side GitHub REST reads (classic PAT, public-repo read scope only). Builds the Dossier. Never called from the client. |
| `ANTHROPIC_API_KEY` | **Required** | Server-side Claude calls: autopsy synthesis and the ghost chat. |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis REST endpoint for the 24h Dossier/autopsy cache and the chat rate-limit store. Omit locally to use the in-memory LRU fallback. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Token paired with `UPSTASH_REDIS_REST_URL`. |

All tokens are server-side only; a CI gate greps the client bundle to prove no secret name or value can reach it.

## Deploying & operating

Deployment is zero-config on Vercel — it detects Next.js and builds. The two clicks a build agent cannot perform for you (branch protection on `main`, the Vercel environment variables, and the domain) are written up as a short checklist in [`SETUP.md`](SETUP.md).

## Further reading

- [`docs/SPEC.md`](docs/SPEC.md) — the frozen brief this project was built against.
- [`RUN_LOG.md`](RUN_LOG.md) — the honest, dated history of the build, failures included.
- [`evals/README.md`](evals/README.md) — the record/replay eval design in full.
- [`SETUP.md`](SETUP.md) — the human deploy checklist.
