/**
 * Chat request-body contract (SPEC §5). Workstream D — the Interrogation.
 *
 * Kept separate from `route.ts` so the validation is pure and unit-testable
 * without booting the streaming handler. The body is zod-validated (roles,
 * per-message length, presence); the history is then capped to the most recent
 * turns and normalised so it always starts with a user turn (the Anthropic
 * Messages API rejects a leading assistant message).
 */
import { z } from "zod";

/** Max characters accepted for a single message's content (SPEC §5). */
export const MAX_CONTENT_CHARS = 2000;
/** Most recent turns retained before calling the model (SPEC §5). */
export const MAX_TURNS = 20;
/** Hard upper bound on the raw array, to reject abusive payloads outright. */
const MAX_RAW_MESSAGES = 500;

/** One chat turn as sent by the client. */
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_CONTENT_CHARS),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** The full POST body: which repo, and the client-held conversation so far. */
export const ChatRequestSchema = z.object({
  owner: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9-]+$/, "invalid owner"),
  repo: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/, "invalid repo"),
  messages: z.array(ChatMessageSchema).min(1).max(MAX_RAW_MESSAGES),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** A validated, normalised request ready for the model. */
export interface ParsedChatRequest {
  owner: string;
  repo: string;
  messages: ChatMessage[];
}

export type ParseChatBodyResult =
  | { ok: true; value: ParsedChatRequest }
  | { ok: false; error: string };

/**
 * Keep the most recent `MAX_TURNS` messages, then drop any leading assistant
 * turns so the sequence begins with a user message (Anthropic requirement).
 */
export function normalizeHistory(messages: ChatMessage[]): ChatMessage[] {
  const tail = messages.slice(-MAX_TURNS);
  let start = 0;
  while (start < tail.length && tail[start].role === "assistant") start += 1;
  return tail.slice(start);
}

/** Validate and normalise an untrusted request body. Never throws. */
export function parseChatBody(raw: unknown): ParseChatBodyResult {
  const parsed = ChatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid_request" };
  }
  const messages = normalizeHistory(parsed.data.messages);
  if (messages.length === 0) {
    return { ok: false, error: "empty_history" };
  }
  return {
    ok: true,
    value: {
      owner: parsed.data.owner,
      repo: parsed.data.repo,
      messages,
    },
  };
}
