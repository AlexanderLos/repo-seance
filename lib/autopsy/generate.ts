/**
 * Autopsy synthesis (SPEC §4). One grounded LLM call turns a Dossier into a
 * strictly-validated Autopsy; a single corrective retry covers parse failures.
 * `getOrCreateAutopsy` wraps that in the cache and the §4 hard rule — evidence is
 * validated in CODE, invalid refs stripped, evidence-less causes dropped — and
 * refuses outright to autopsy a living repository (defence in depth, SPEC §3).
 */
import { APIError } from "@anthropic-ai/sdk";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Dossier } from "../dossier/types";
import { AutopsySchema, type Autopsy } from "./schema";
import { buildAutopsyPrompt } from "./prompt";
import { getAnthropic } from "../anthropic/client";
import { validateEvidence } from "../evidence/validate";
import { getPrecached } from "../graveyard/precached";
import { getCache } from "../cache";
import { autopsyKey, TTL_24H } from "../cache/keys";

/** Spec §2 mandate — the autopsy is always synthesized by Sonnet 4.6. */
const MODEL = "claude-sonnet-4-6";
/** Generous ceiling for one JSON autopsy; well under the model's limit. */
const MAX_TOKENS = 8000;

/** Thrown when synthesis cannot produce a usable, evidence-backed autopsy. */
export class AutopsySynthesisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutopsySynthesisError";
  }
}

/** Thrown if an autopsy is ever requested for a repository that still breathes. */
export class AliveRepoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AliveRepoError";
  }
}

/** Outcome of a single `messages.parse` attempt. */
interface ParseOutcome {
  /** The parsed autopsy, or null when this attempt did not yield one. */
  autopsy: Autopsy | null;
  /** Human-readable reason a null attempt failed, for the corrective retry. */
  reason: string;
}

/**
 * One structured-output call. Returns the parsed autopsy, or a null outcome with
 * a reason when the model refused or emitted no valid JSON. Genuine transport /
 * HTTP failures (auth, rate limit, network) are NOT parse problems, so they are
 * re-thrown untouched rather than consuming the single corrective retry.
 */
async function runParse(
  client: Anthropic,
  prompt: string,
): Promise<ParseOutcome> {
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(AutopsySchema) },
    });

    if (response.stop_reason === "refusal") {
      return { autopsy: null, reason: "the model refused to respond" };
    }
    const parsed = response.parsed_output;
    if (parsed === null) {
      return { autopsy: null, reason: "no structured JSON output was returned" };
    }
    return { autopsy: parsed, reason: "" };
  } catch (error) {
    if (error instanceof APIError) {
      // Transport / HTTP / auth failure — surface it; the SDK has already applied
      // its own network retries and this is not something a reprompt can fix.
      throw error;
    }
    // The zod output helper throws a plain AnthropicError on invalid JSON or a
    // schema mismatch — that IS a parse failure, so fold it into a retryable null.
    return {
      autopsy: null,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * One LLM call, strict schema, one reject-and-retry (SPEC §4). Evidence is NOT
 * validated here — that is the caller's policy in `getOrCreateAutopsy`. Sonnet
 * 4.6 rejects assistant prefill, so the corrective note is appended to the same
 * user turn rather than seeded as an assistant message.
 */
export async function synthesizeAutopsy(
  dossier: Dossier,
  client?: Anthropic,
): Promise<Autopsy> {
  const anthropic = client ?? getAnthropic();
  const prompt = buildAutopsyPrompt(dossier);

  const first = await runParse(anthropic, prompt);
  if (first.autopsy !== null) return first.autopsy;

  const corrective = `${prompt}\n\nYour previous output failed validation: ${first.reason}. Emit ONLY valid JSON matching the required schema, with no prose before or after it.`;
  const second = await runParse(anthropic, corrective);
  if (second.autopsy !== null) return second.autopsy;

  throw new AutopsySynthesisError(
    `Autopsy synthesis failed after one corrective retry: ${second.reason}.`,
  );
}

/**
 * Synthesize, then enforce the §4 hard rule in code: strip unresolvable evidence
 * refs and drop any cause left with nothing that resolves (both logged by
 * `validateEvidence`). If every cause evaporates, re-synthesize exactly once
 * before giving up.
 */
async function synthesizeValidated(dossier: Dossier): Promise<Autopsy> {
  const first = await synthesizeAutopsy(dossier);
  const firstPass = validateEvidence(dossier, first.causes);
  if (firstPass.causes.length >= 1) {
    return { ...first, causes: firstPass.causes };
  }

  // No cited cause survived validation — a hallucinated citation set. Give
  // synthesis one more chance before declaring the séance a failure.
  const second = await synthesizeAutopsy(dossier);
  const secondPass = validateEvidence(dossier, second.causes);
  if (secondPass.causes.length >= 1) {
    return { ...second, causes: secondPass.causes };
  }

  throw new AutopsySynthesisError(
    `No cause of death survived evidence validation for ${dossier.repo.fullName}.`,
  );
}

/**
 * Cache-aware autopsy (SPEC §3/§4/§6). Reads `autopsy:{owner}/{repo}:v1`; on a
 * miss it consults the committed Graveyard snapshot before ever paying an LLM
 * call, so a curated demo click is instant and free (SPEC §6 "pre-cached
 * autopsies so demo clicks are instant"). Only a non-Graveyard repo falls
 * through to live synthesis. In all three cases the validated result is cached
 * for 24h. Never synthesizes for a living repository.
 */
export async function getOrCreateAutopsy(dossier: Dossier): Promise<Autopsy> {
  // Defence in depth (SPEC §3): the UI must never request an autopsy for a living
  // repo, but if it somehow does, refuse rather than fabricate a death.
  if (dossier.death.status === "alive") {
    throw new AliveRepoError(
      `Refusing to autopsy a living repository: ${dossier.repo.fullName} still breathes.`,
    );
  }

  const cache = getCache();
  // Lower-case owner/repo so `Atom/Atom` and `atom/atom` share one cache entry.
  const key = autopsyKey(
    dossier.repo.owner.toLowerCase(),
    dossier.repo.name.toLowerCase(),
  );

  const cached = await cache.get<Autopsy>(key);
  if (cached !== null) return cached;

  // A curated Graveyard repo ships a committed {dossier, autopsy} snapshot. On a
  // cold cache, serve that instead of re-synthesizing (SPEC §6/§3): re-validate
  // its evidence in code (the §4 hard rule as defence in depth), write it through
  // the cache, and return it — no LLM call. Non-Graveyard repos get null here and
  // fall through to synthesis unchanged.
  const precached = await getPrecached(dossier.repo.owner, dossier.repo.name);
  if (precached !== null) {
    const { causes } = validateEvidence(
      precached.dossier,
      precached.autopsy.causes,
    );
    const fromSnapshot: Autopsy = { ...precached.autopsy, causes };
    await cache.set(key, fromSnapshot, TTL_24H);
    return fromSnapshot;
  }

  const validated = await synthesizeValidated(dossier);
  await cache.set(key, validated, TTL_24H);
  return validated;
}
