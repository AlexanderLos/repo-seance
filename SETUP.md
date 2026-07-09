# SETUP — the human clicks

The autonomous build run finishes the code, the CI, and the evals. Three things it *cannot* do for you — they require an account holder pressing buttons in a web UI — are collected here. None takes more than a minute.

Do them in order: **protect the branch, give the deploy its keys, then name the grave.**

---

## 1. Branch protection on `main`

Make the CI pipeline a required gate so nothing merges to `main` without it going green. The workflow is [`.github/workflows/ci.yml`](.github/workflows/ci.yml); its single job is named **`verify`** (typecheck, lint, tests, evals, the hard-coded-stats gate, build, and the bundle-secret gate — all blocking).

> CI has already run green on `main`, so the check named **`verify`** is available in the picker now. (Required checks only appear after their first run — that run is done.)

1. Open **Settings → Branches** (or **Settings → Rules → Rulesets**) on `AlexanderLos/repo-seance`.
2. Add a branch protection rule / ruleset targeting the branch **`main`**.
3. Enable **Require a pull request before merging**.
4. Enable **Require status checks to pass before merging**, then search for and select the check named **`verify`**. Also tick **Require branches to be up to date before merging**.
5. Enable **Do not allow bypassing the above settings** (this applies the rule to administrators too — no bypass).
6. Save.

Done: `main` now only accepts changes that pass the full pipeline.

## 2. Vercel — environment variables & deploy

Deployment is zero-config: Vercel detects Next.js and builds. You only need to hand it the keys.

1. In Vercel, **Add New → Project** and import `AlexanderLos/repo-seance`. Leave the framework/build settings as detected (Next.js).
2. Open **Project → Settings → Environment Variables** and add the following (**names only shown here — paste your own values, and never commit them**). Add each to **Production** and **Preview**:

   | Variable | Required | Notes |
   | --- | --- | --- |
   | `GITHUB_TOKEN` | **Required** | Public-repo read-only PAT (fine-grained or classic both work). |
   | `ANTHROPIC_API_KEY` | **Required** | Server-side Claude access. |
   | `UPSTASH_REDIS_REST_URL` | Optional | Enables the shared 24h cache and the chat rate-limit store. |
   | `UPSTASH_REDIS_REST_TOKEN` | Optional | Pairs with the Upstash URL. |

   The two required keys must be present or the app will render its styled "missing configuration" page instead of an autopsy.

   > **Serverless caveat — Upstash is optional locally, but strongly recommended in production.** Without it the fallback cache and rate limiter are **in-memory, per lambda instance**: dossier/autopsy caches don't survive across instances or cold starts (repeat visits to the same non-graveyard repo can re-pay the GitHub + Claude cost), and the 20-messages-per-hour chat limit is enforced per instance rather than globally, so it is effectively looser than designed. The 15 pre-cached graveyard repos are unaffected (they ship as committed snapshots).
3. **Function duration.** A cold exhume of an uncached repo does real work — paginated GitHub fetches plus one Claude synthesis — measured at ~20s+ end to end, and ghost-chat responses stream for up to ~30s. The default serverless function timeout will cut these off. In **Project → Settings → Functions**, raise the max duration to **60s** (or set `export const maxDuration = 60` in `app/api/exhume/route.ts` and `app/api/chat/route.ts` as a code-level follow-up). Graveyard demo clicks are unaffected — they serve from committed snapshots in milliseconds.
4. **Deploy** (or redeploy, so the new variables take effect). The build runs the same gates CI does.

## 3. Domain

Repo Séance is meant to live at a single-purpose domain — the name is part of the artifact.

1. Open **Project → Settings → Domains** in Vercel.
2. **Add** your domain (apex or subdomain).
3. Follow Vercel's DNS instructions at your registrar (an `A` / `ALIAS` record for an apex, or a `CNAME` for a subdomain). Wait for it to verify.

Once it goes green, the séance is open to the public.

---

*Reference: [`docs/SPEC.md`](docs/SPEC.md) §8. Local development and the env-var meanings live in [`README.md`](README.md).*
