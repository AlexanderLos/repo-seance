/**
 * The Interrogation route (SPEC §5). Workstream D.
 *
 * POST { owner, repo, messages } → a server-sent event stream:
 *   data: {"type":"delta","text":"…"}      (many, while the ghost speaks)
 *   data: {"type":"final","display":…,"refused":…,"chips":[…]}   (once, validated)
 *   data: {"type":"done"}
 * or, on an upstream failure:
 *   data: {"type":"error","code":"not_found"|"rate_limited"|"seance_failed"}
 *
 * The final event is the authoritative answer: it comes from post-validating the
 * FULL streamed text against the Dossier (`finalizeGhostAnswer`), so a client
 * must swap whatever it streamed for `final.display` (and, when refused, drop it
 * for the canonical refusal). No chat history is persisted — it lives client-side
 * only. Uses the Web `Request`/`Response` + `ReadableStream` so the module never
 * pulls in the Next server runtime.
 */
import { buildDossier } from "../../../lib/dossier/build";
import { DossierSchema, type Dossier } from "../../../lib/dossier/types";
import { getCache } from "../../../lib/cache";
import { dossierKey, TTL_24H } from "../../../lib/cache/keys";
import { getAnthropic } from "../../../lib/anthropic/client";
import { buildGhostSystemPrompt } from "../../../lib/ghost/prompt";
import { finalizeGhostAnswer } from "../../../lib/ghost/postprocess";
import {
  RepoNotFoundError,
  GitHubRateLimitError,
} from "../../../lib/github/errors";
import { parseChatBody } from "./request";

export const runtime = "nodejs";

/** The chat model. `claude-sonnet-4-6` per the séance's SDK contract. */
const CHAT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

type UpstreamErrorCode = "not_found" | "rate_limited" | "seance_failed";

const encoder = new TextEncoder();

/** Encode one SSE `data:` frame. */
function frame(payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/** Map an upstream failure to its in-band error code. */
function toErrorCode(err: unknown): UpstreamErrorCode {
  if (err instanceof RepoNotFoundError) return "not_found";
  if (err instanceof GitHubRateLimitError) return "rate_limited";
  return "seance_failed";
}

/**
 * Cache-hot Dossier: serve a valid cached copy if present, else build and cache
 * it (SPEC §3, 24h TTL). Owner/repo are already lower-cased by the caller so
 * `Atom/Atom` and `atom/atom` share one entry.
 */
async function getDossierCached(owner: string, repo: string): Promise<Dossier> {
  const cache = getCache();
  const key = dossierKey(owner, repo);
  const cached = await cache.get<unknown>(key);
  if (cached !== null) {
    const parsed = DossierSchema.safeParse(cached);
    if (parsed.success) return parsed.data;
  }
  const dossier = await buildDossier(owner, repo);
  await cache.set(key, dossier, TTL_24H);
  return dossier;
}

/** Concatenate the text blocks of a finished Anthropic message. */
function textOf(content: { type: string }[]): string {
  let out = "";
  for (const block of content) {
    if (block.type === "text" && "text" in block) {
      out += (block as { text: string }).text;
    }
  }
  return out;
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown = null;
  try {
    raw = await request.json();
  } catch {
    raw = null;
  }

  const parsed = parseChatBody(raw);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const owner = parsed.value.owner.toLowerCase();
  const repo = parsed.value.repo.toLowerCase();
  const messages = parsed.value.messages;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: unknown): void => {
        controller.enqueue(frame(payload));
      };

      void (async () => {
        // Stage 1 — the Dossier. Its failures carry meaningful codes.
        let dossier: Dossier;
        try {
          dossier = await getDossierCached(owner, repo);
        } catch (err) {
          send({ type: "error", code: toErrorCode(err) });
          controller.close();
          return;
        }

        // Stage 2 — the séance. Any failure here is a generic séance failure.
        try {
          const systemPrompt = buildGhostSystemPrompt(dossier);
          const client = getAnthropic();
          const ghost = client.messages.stream({
            model: CHAT_MODEL,
            max_tokens: MAX_TOKENS,
            system: [
              {
                type: "text",
                text: systemPrompt,
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          });

          for await (const event of ghost) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send({ type: "delta", text: event.delta.text });
            }
          }

          const finalMessage = await ghost.finalMessage();
          const fullText = textOf(finalMessage.content);
          const finalized = finalizeGhostAnswer(dossier, fullText);
          send({
            type: "final",
            display: finalized.display,
            refused: finalized.refused,
            chips: finalized.chips,
          });
          send({ type: "done" });
          controller.close();
        } catch {
          send({ type: "error", code: "seance_failed" });
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
