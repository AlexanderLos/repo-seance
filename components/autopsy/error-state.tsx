/**
 * Designed, in-voice failure surfaces (SPEC §6). Repo-not-found and GitHub
 * rate-limit are dead ends with a way home; analysis failure is an honest
 * apology with a retry. Copy never blames the visitor and never leaks internals.
 */
import Link from "next/link";
import type { ExhumeErrorCode } from "@/app/api/exhume/protocol";

const COPY: Record<
  ExhumeErrorCode,
  { title: string; body: string; retry: boolean }
> = {
  not_found: {
    title: "No grave by that name.",
    body: "We searched the archive and found nothing — or it rests somewhere private, and we do not pry. Check the owner and repository, then try again.",
    retry: false,
  },
  rate_limited: {
    title: "The archive is sealed for now.",
    body: "GitHub has briefly closed its doors to us. The dead are patient; wait a moment, then knock again.",
    retry: true,
  },
  analysis_failed: {
    title: "The séance faltered.",
    body: "Something went wrong on our side — not yours. The connection to the departed broke mid-reading. Try once more.",
    retry: true,
  },
};

export function ErrorState({
  code,
  onRetry,
}: {
  code: ExhumeErrorCode;
  onRetry: () => void;
}) {
  const copy = COPY[code];

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div className="rotate-[-9deg] border-[3px] border-double border-sc-danger-line px-6 py-2.5 text-[15px] uppercase tracking-[.3em] text-sc-danger opacity-90">
        {code === "not_found" ? "Not found" : "Interrupted"}
      </div>

      <h1 className="mt-8 text-balance font-serif text-4xl text-sc-head">
        {copy.title}
      </h1>
      <p className="mt-4 max-w-md font-serif text-lg italic leading-relaxed text-sc-epitaph">
        {copy.body}
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        {copy.retry ? (
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer border border-sc-border bg-sc-btn px-6 py-3 font-mono text-[11px] uppercase tracking-[.18em] text-sc-accent transition-colors hover:bg-sc-btn-hi hover:text-sc-accent-hi"
          >
            Try the séance again
          </button>
        ) : null}
        <Link
          href="/#graveyard"
          className="border border-sc-border px-6 py-3 font-mono text-[11px] uppercase tracking-[.18em] text-sc-body transition-colors hover:border-sc-border-hi hover:text-sc-ink"
        >
          Back to the Graveyard
        </Link>
      </div>
    </div>
  );
}
