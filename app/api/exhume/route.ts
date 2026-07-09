/**
 * GET /api/exhume?owner=&repo=  — the exhumation stream (SPEC §6, item 2).
 *
 * Emits newline-delimited JSON so the client can narrate a themed, REAL-stage
 * loader (not a fake timer): a `locating` line before metadata, `ledger` lines
 * as the commit/branch/issue ledger is read, a `contacting` line right before
 * the LLM, then exactly one terminal line — an autopsy, an "alive" verdict (no
 * LLM call, SPEC §3), or a mapped error.
 */
import { buildDossier } from "@/lib/dossier/build";
import { getOrCreateAutopsy } from "@/lib/autopsy/generate";
import {
  RepoNotFoundError,
  GitHubRateLimitError,
} from "@/lib/github/errors";
import {
  ritualStageForDossierStage,
  type ExhumeEvent,
  type RitualStage,
} from "./protocol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner")?.trim();
  const repo = searchParams.get("repo")?.trim();

  if (!owner || !repo) {
    return new Response(
      JSON.stringify({ error: "not_found" } satisfies ExhumeEvent) + "\n",
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: ExhumeEvent): void => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      // Collapse consecutive duplicate stages so the loader advances cleanly.
      let lastStage: RitualStage | null = null;
      const emitStage = (stage: RitualStage): void => {
        if (stage === lastStage) return;
        lastStage = stage;
        send({ stage });
      };

      try {
        emitStage("locating");

        const dossier = await buildDossier(owner, repo, {
          onStage: (stage) => emitStage(ritualStageForDossierStage(stage)),
        });

        if (dossier.death.status === "alive") {
          // Living repos never get a death certificate (SPEC §3) — no LLM call.
          send({ done: true, alive: true, dossier });
        } else {
          emitStage("contacting");
          const autopsy = await getOrCreateAutopsy(dossier);
          send({ done: true, dossier, autopsy });
        }
      } catch (error) {
        if (error instanceof RepoNotFoundError) {
          send({ error: "not_found" });
        } else if (error instanceof GitHubRateLimitError) {
          send({ error: "rate_limited" });
        } else {
          console.error("[exhume] analysis failed:", error);
          send({ error: "analysis_failed" });
        }
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Disable proxy buffering so stage lines flush as they happen.
      "X-Accel-Buffering": "no",
    },
  });
}
