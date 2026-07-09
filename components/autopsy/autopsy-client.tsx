"use client";

/**
 * The autopsy orchestrator (SPEC §6, architecture item 3). `AutopsyClient` owns
 * the retry counter and keys the inner `ExhumeRun` on owner/repo/attempt so each
 * run gets a clean mount (no synchronous state resets inside an effect). The run
 * opens the /api/exhume NDJSON stream, advances the ritual loader on REAL stage
 * lines, and renders the terminal outcome: the full autopsy grid (case file +
 * interrogation rail), the living-repo page, or a designed error with retry.
 * Elapsed time is measured client-side — the honest per-request "analysis
 * completed in Xs".
 */
import { useEffect, useRef, useState } from "react";
import {
  isAliveEvent,
  isAutopsyEvent,
  isErrorEvent,
  isStageEvent,
  type ExhumeErrorCode,
  type ExhumeEvent,
  type RitualStage,
} from "@/app/api/exhume/protocol";
import type { Dossier } from "@/lib/dossier/types";
import type { Autopsy } from "@/lib/autopsy/schema";
import { RitualLoader } from "./ritual-loader";
import { ErrorState } from "./error-state";
import { AliveState } from "./alive-state";
import { CaseFile } from "./case-file";
import { InterrogationPanel } from "./interrogation-panel";

type View =
  | { kind: "ritual"; stage: RitualStage }
  | { kind: "autopsy"; dossier: Dossier; autopsy: Autopsy; elapsed: number }
  | { kind: "alive"; dossier: Dossier }
  | { kind: "error"; code: ExhumeErrorCode };

const SHELL = "mx-auto w-full max-w-[1600px] px-4 pb-4 pt-[22px] sm:px-7";

export function AutopsyClient({ owner, repo }: { owner: string; repo: string }) {
  const [attempt, setAttempt] = useState(0);
  // Keying on attempt remounts the run for a clean retry — no in-effect resets.
  return (
    <ExhumeRun
      key={`${owner}/${repo}/${attempt}`}
      owner={owner}
      repo={repo}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function ExhumeRun({
  owner,
  repo,
  onRetry,
}: {
  owner: string;
  repo: string;
  onRetry: () => void;
}) {
  const [view, setView] = useState<View>({ kind: "ritual", stage: "locating" });
  const startedAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let sawTerminal = false;
    const controller = new AbortController();
    startedAt.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const elapsed = () => {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      return (now - startedAt.current) / 1000;
    };

    const handle = (event: ExhumeEvent) => {
      if (cancelled) return;
      if (isStageEvent(event)) {
        setView({ kind: "ritual", stage: event.stage });
      } else if (isAliveEvent(event)) {
        sawTerminal = true;
        setView({ kind: "alive", dossier: event.dossier });
      } else if (isAutopsyEvent(event)) {
        sawTerminal = true;
        setView({
          kind: "autopsy",
          dossier: event.dossier,
          autopsy: event.autopsy,
          elapsed: elapsed(),
        });
      } else if (isErrorEvent(event)) {
        sawTerminal = true;
        setView({ kind: "error", code: event.error });
      }
    };

    async function run() {
      try {
        const url = `/api/exhume?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/x-ndjson" },
        });
        if (!res.ok || res.body === null) {
          if (!cancelled) setView({ kind: "error", code: "analysis_failed" });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const drain = (chunk: string) => {
          buffer += chunk;
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line) {
              try {
                handle(JSON.parse(line) as ExhumeEvent);
              } catch {
                /* skip a malformed line rather than kill the stream */
              }
            }
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          drain(decoder.decode(value, { stream: true }));
        }
        const tail = buffer.trim();
        if (tail) {
          try {
            handle(JSON.parse(tail) as ExhumeEvent);
          } catch {
            /* ignore a malformed trailing line */
          }
        }

        // Stream closed without a verdict — treat as a broken séance.
        if (!cancelled && !sawTerminal) {
          setView({ kind: "error", code: "analysis_failed" });
        }
      } catch {
        if (!cancelled) setView({ kind: "error", code: "analysis_failed" });
      }
    }

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [owner, repo]);

  if (view.kind === "ritual") {
    return (
      <div className={SHELL}>
        <RitualLoader stage={view.stage} />
      </div>
    );
  }

  if (view.kind === "error") {
    return (
      <div className={SHELL}>
        <ErrorState code={view.code} onRetry={onRetry} />
      </div>
    );
  }

  if (view.kind === "alive") {
    return <AliveState dossier={view.dossier} />;
  }

  return (
    <div className={SHELL}>
      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_396px]">
        <CaseFile
          dossier={view.dossier}
          autopsy={view.autopsy}
          elapsedSeconds={view.elapsed}
        />
        <InterrogationPanel owner={owner} repo={repo} />
      </div>
    </div>
  );
}
