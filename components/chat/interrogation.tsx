"use client";

/**
 * The Interrogation — chat with the repository's ghost (SPEC §5). Workstream D.
 *
 * Streams from POST /api/chat: delta events paint the answer as it is spoken,
 * then a single `final` event carries the post-validated result. Validation is
 * authoritative over the stream — when `final.refused` is true the streamed text
 * is replaced by the canonical refusal and every chip is dropped. Evidence chips
 * link to real GitHub URLs; history lives only in this component's state.
 *
 * Desktop: a right-rail panel. Mobile: a launcher opens a full-height sheet.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";
import { CANONICAL_REFUSAL } from "../../lib/ghost/refusal";
import type { EvidenceChip } from "../../lib/ghost/postprocess";

export interface InterrogationProps {
  owner: string;
  repo: string;
}

/* ── copy (rendered via {expressions} so no JSX entity needs escaping) ── */
const HEADER = "Interrogation";
const SUBTITLE =
  "Every answer cites its evidence. No séance theatrics without receipts.";
const PLACEHOLDER = "Ask the departed…";
const SEND_GLYPH = "☽";
const SEED_TEXT = "Speak, and I will answer — but only with what remains of me.";
const MICROCOPY = "Every answer is weighed against the repository's own record.";
const TIRED_COPY = "The spirits tire. Return within the hour.";
const LAUNCHER_COPY = "Speak with the ghost";
const ERROR_COPY: Record<UpstreamErrorCode, string> = {
  not_found: "No grave by that name.",
  rate_limited: "The archive is sealed for now.",
  seance_failed: "The séance faltered. Ask me again.",
};

/* ── palette (DESIGN-NOTES §1, dim body grays brightened per SPEC §6) ── */
const C = {
  panelBorder: "#2c2416",
  panelBg: "#12100a",
  hairline: "#241d11",
  heading: "#8d8268",
  subtitle: "#8d8268",
  ghostBg: "#10130d",
  ghostBorder: "#2f3d2a",
  ghostText: "#b9c4ae",
  userBg: "#17130b",
  userBorder: "#2c2416",
  userText: "#a89c7e",
  chipBg: "#0e0c08",
  chipBorder: "#2c2416",
  chipText: "#8d8268",
  chipHoverText: "#c9973f",
  chipHoverBorder: "#4a3c20",
  inputBg: "#0e0c08",
  inputText: "#cfc5a9",
  sendBg: "#1c160c",
  sendText: "#c9973f",
  note: "#8d8268",
  microcopy: "#6b6250",
} as const;

const SERIF = "var(--font-serif), Georgia, serif";
const MONO = "var(--font-mono), ui-monospace, monospace";

/* ── server-sent event contract (mirrors app/api/chat/route.ts) ── */
type UpstreamErrorCode = "not_found" | "rate_limited" | "seance_failed";

type ServerEvent =
  | { type: "delta"; text: string }
  | { type: "final"; display: string; refused: boolean; chips: EvidenceChip[] }
  | { type: "error"; code: UpstreamErrorCode }
  | { type: "done" };

/** Parse one SSE `data:` payload into a typed event, or null if unrecognised. */
function parseServerEvent(payload: string): ServerEvent | null {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || !("type" in data)) {
    return null;
  }
  const record = data as Record<string, unknown>;
  switch (record.type) {
    case "delta":
      return typeof record.text === "string"
        ? { type: "delta", text: record.text }
        : null;
    case "final":
      return {
        type: "final",
        display: typeof record.display === "string" ? record.display : "",
        refused: record.refused === true,
        chips: Array.isArray(record.chips)
          ? (record.chips as EvidenceChip[])
          : [],
      };
    case "error": {
      const code = record.code;
      return {
        type: "error",
        code:
          code === "not_found" || code === "rate_limited"
            ? code
            : "seance_failed",
      };
    }
    case "done":
      return { type: "done" };
    default:
      return null;
  }
}

type MessageKind = "answer" | "seed" | "note";

interface UiMessage {
  id: number;
  sender: "user" | "ghost";
  text: string;
  chips: EvidenceChip[];
  refused: boolean;
  streaming: boolean;
  kind: MessageKind;
}

const SEED_MESSAGE: UiMessage = {
  id: 0,
  sender: "ghost",
  text: SEED_TEXT,
  chips: [],
  refused: false,
  streaming: false,
  kind: "seed",
};

export function Interrogation({ owner, repo }: InterrogationProps) {
  const [messages, setMessages] = useState<UiMessage[]>([SEED_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  // Keep the transcript pinned to the newest line as it streams.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const patchMessage = useCallback(
    (id: number, patch: Partial<UiMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
    },
    [],
  );

  const appendDelta = useCallback((id: number, text: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text: m.text + text } : m)),
    );
  }, []);

  const runSeance = useCallback(
    async (
      history: { role: "user" | "assistant"; content: string }[],
      ghostId: number,
    ) => {
      let finalized = false;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, repo, messages: history }),
        });

        if (res.status === 429) {
          patchMessage(ghostId, {
            text: TIRED_COPY,
            streaming: false,
            kind: "note",
          });
          return;
        }
        if (!res.ok || res.body === null) {
          patchMessage(ghostId, {
            text: ERROR_COPY.seance_failed,
            streaming: false,
            kind: "note",
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep = buffer.indexOf("\n\n");
          while (sep !== -1) {
            const rawFrame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const dataLine = rawFrame
              .split("\n")
              .find((line) => line.startsWith("data:"));
            if (dataLine) {
              const payload = dataLine.slice("data:".length).trim();
              const event = payload ? parseServerEvent(payload) : null;
              if (event) {
                if (event.type === "delta") {
                  if (!finalized) appendDelta(ghostId, event.text);
                } else if (event.type === "final") {
                  finalized = true;
                  patchMessage(ghostId, {
                    text: event.refused ? CANONICAL_REFUSAL : event.display,
                    chips: event.refused ? [] : event.chips,
                    refused: event.refused,
                    streaming: false,
                  });
                } else if (event.type === "error") {
                  patchMessage(ghostId, {
                    text: ERROR_COPY[event.code],
                    chips: [],
                    refused: false,
                    streaming: false,
                    kind: "note",
                  });
                } else {
                  patchMessage(ghostId, { streaming: false });
                }
              }
            }
            sep = buffer.indexOf("\n\n");
          }
        }
      } catch {
        patchMessage(ghostId, {
          text: ERROR_COPY.seance_failed,
          streaming: false,
          kind: "note",
        });
      }
    },
    [owner, repo, appendDelta, patchMessage],
  );

  const submit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      const question = draft.trim();
      if (question.length === 0 || sending) return;

      const history = messages
        .filter((m) => m.kind === "answer" && !m.streaming)
        .map((m) => ({
          role: (m.sender === "ghost" ? "assistant" : "user") as
            | "user"
            | "assistant",
          content: m.text,
        }));
      history.push({ role: "user", content: question });

      const userMessage: UiMessage = {
        id: nextId(),
        sender: "user",
        text: question,
        chips: [],
        refused: false,
        streaming: false,
        kind: "answer",
      };
      const ghostId = nextId();
      const ghostMessage: UiMessage = {
        id: ghostId,
        sender: "ghost",
        text: "",
        chips: [],
        refused: false,
        streaming: true,
        kind: "answer",
      };

      setMessages((prev) => [...prev, userMessage, ghostMessage]);
      setDraft("");
      setSending(true);
      void runSeance(history, ghostId).finally(() => setSending(false));
    },
    [draft, sending, messages, runSeance],
  );

  const onDraftChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  };

  const panelClassName = [
    "flex flex-col min-h-0 border",
    open
      ? "fixed inset-0 z-50 h-[100dvh] md:static md:z-auto md:h-full md:max-h-[calc(100dvh-120px)]"
      : "hidden md:flex md:h-full md:max-h-[calc(100dvh-120px)]",
  ].join(" ");

  return (
    <>
      <section
        className={panelClassName}
        style={{ borderColor: C.panelBorder, background: C.panelBg }}
        aria-label="Interrogation of the departed repository"
      >
        <header
          className="flex items-start justify-between gap-3 px-[22px] pt-5 pb-4"
          style={{ borderBottom: `1px solid ${C.hairline}` }}
        >
          <div>
            <h2
              className="m-0 uppercase"
              style={{
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.26em",
                color: C.heading,
              }}
            >
              {HEADER}
            </h2>
            <p
              className="mt-1.5 mb-0"
              style={{ fontFamily: MONO, fontSize: 11, color: C.subtitle }}
            >
              {SUBTITLE}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close the interrogation"
            className="md:hidden shrink-0 cursor-pointer border-0 bg-transparent px-1 text-lg leading-none"
            style={{ color: C.heading, fontFamily: MONO }}
          >
            ✕
          </button>
        </header>

        <div
          ref={listRef}
          className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-5"
          aria-live="polite"
        >
          {messages.map((message) => (
            <MessageRow key={message.id} message={message} />
          ))}
        </div>

        <form
          onSubmit={submit}
          className="px-[22px] pt-4 pb-[18px]"
          style={{ borderTop: `1px solid ${C.hairline}` }}
        >
          <div
            className="flex items-stretch"
            style={{
              border: `1px solid ${C.panelBorder}`,
              background: C.inputBg,
              height: 42,
            }}
          >
            <input
              value={draft}
              onChange={onDraftChange}
              placeholder={PLACEHOLDER}
              aria-label="Ask the departed a question"
              className="min-w-0 flex-1 border-0 bg-transparent px-3.5 outline-none"
              style={{ fontFamily: MONO, fontSize: 12.5, color: C.inputText }}
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={sending || draft.trim().length === 0}
              className="cursor-pointer border-0 px-4 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderLeft: `1px solid ${C.panelBorder}`,
                background: C.sendBg,
                color: C.sendText,
                fontFamily: MONO,
                fontSize: 15,
              }}
            >
              {SEND_GLYPH}
            </button>
          </div>
          <p
            className="mt-2 mb-0 text-center"
            style={{ fontFamily: MONO, fontSize: 10, color: C.microcopy }}
          >
            {MICROCOPY}
          </p>
        </form>
      </section>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the interrogation"
          className="md:hidden fixed bottom-4 right-4 z-40 flex cursor-pointer items-center gap-2 px-4 py-3 uppercase shadow-lg"
          style={{
            border: `1px solid ${C.chipHoverBorder}`,
            background: C.sendBg,
            color: C.sendText,
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.14em",
          }}
        >
          <span aria-hidden="true">{SEND_GLYPH}</span>
          {LAUNCHER_COPY}
        </button>
      )}
    </>
  );
}

/* ── one transcript row ── */
function MessageRow({ message }: { message: UiMessage }) {
  if (message.kind === "note") {
    return (
      <p
        className="my-0 text-center italic"
        style={{ fontFamily: SERIF, fontSize: 14, color: C.note }}
      >
        {message.text}
      </p>
    );
  }

  const isGhost = message.sender === "ghost";
  const bubbleStyle: CSSProperties = isGhost
    ? {
        background: C.ghostBg,
        border: `1px solid ${message.refused ? C.hairline : C.ghostBorder}`,
        color: C.ghostText,
        fontFamily: SERIF,
        fontSize: 17,
        fontStyle: "italic",
        lineHeight: 1.55,
        padding: "12px 16px",
      }
    : {
        background: C.userBg,
        border: `1px solid ${C.userBorder}`,
        color: C.userText,
        fontFamily: MONO,
        fontSize: 12,
        lineHeight: 1.55,
        padding: "9px 14px",
      };

  const showTyping = isGhost && message.streaming && message.text.length === 0;

  return (
    <div
      className="flex flex-col gap-1.5"
      style={{ alignItems: isGhost ? "flex-start" : "flex-end" }}
    >
      <div style={{ maxWidth: "88%", ...bubbleStyle }}>
        {showTyping ? (
          <span>
            <span aria-hidden="true">…</span>
            <span className="sr-only">The ghost is answering</span>
          </span>
        ) : (
          message.text
        )}
      </div>
      {isGhost && message.chips.length > 0 && (
        <div className="flex max-w-[88%] flex-wrap gap-1.5">
          {message.chips.map((chip) => (
            <EvidenceChipLink key={`${chip.type}:${chip.ref}`} chip={chip} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── an evidence chip: a real link to the cited commit / issue / branch / file ── */
function EvidenceChipLink({ chip }: { chip: EvidenceChip }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={chip.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        fontFamily: MONO,
        fontSize: 11,
        padding: "2px 7px",
        background: C.chipBg,
        border: `1px solid ${hover ? C.chipHoverBorder : C.chipBorder}`,
        color: hover ? C.chipHoverText : C.chipText,
        textDecoration: "none",
      }}
    >
      {chip.label}
    </a>
  );
}
