# SETUP — the human clicks

The autonomous build run finishes the code, the CI, and the evals. Three things it *cannot* do for you — they require an account holder pressing buttons in a web UI — are collected here. None takes more than a minute.

Do them in order: **protect the branch, give the deploy its keys, then name the grave.**

---

## 1. Branch protection on `main`

Make the CI pipeline a required gate so nothing merges to `main` without it going green. The workflow is [`.github/workflows/ci.yml`](.github/workflows/ci.yml); its single job is named **`verify`** (typecheck, lint, tests, evals, the hard-coded-stats gate, build, and the bundle-secret gate — all blocking).

> The required check only appears in the list *after* CI has run at least once on this repository. If you don't see `verify` yet, push a commit or open a PR first, then come back.

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
   | `GITHUB_TOKEN` | **Required** | Classic PAT, public-repo read scope only. |
   | `ANTHROPIC_API_KEY` | **Required** | Server-side Claude access. |
   | `UPSTASH_REDIS_REST_URL` | Optional | Enables the shared 24h cache and chat rate-limit store. Omit to run on the in-memory fallback. |
   | `UPSTASH_REDIS_REST_TOKEN` | Optional | Pairs with the Upstash URL. |

   The two required keys must be present or the app will render its styled "missing configuration" page instead of an autopsy. The two Upstash keys are optional — without them the app still runs, just without a shared cache across instances.
3. **Deploy** (or redeploy, so the new variables take effect). The build runs the same gates CI does.

## 3. Domain

Repo Séance is meant to live at a single-purpose domain — the name is part of the artifact.

1. Open **Project → Settings → Domains** in Vercel.
2. **Add** your domain (apex or subdomain).
3. Follow Vercel's DNS instructions at your registrar (an `A` / `ALIAS` record for an apex, or a `CNAME` for a subdomain). Wait for it to verify.

Once it goes green, the séance is open to the public.

---

*Reference: [`docs/SPEC.md`](docs/SPEC.md) §8. Local development and the env-var meanings live in [`README.md`](README.md).*
