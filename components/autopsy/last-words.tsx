/**
 * Last words (DESIGN-NOTES §5.3c): the terminal-style final-commit box. Shows
 * the real final commit (sha → real link, date, subject line — escaped), an
 * actual TODO the code left behind when the scan found one, and the autopsy's
 * sardonic `lastWordsGloss`. Honest empty state when there is no final commit.
 */
import type { Dossier } from "@/lib/dossier/types";
import { formatDate, shortSha } from "../util/format";

export function LastWords({
  dossier,
  gloss,
}: {
  dossier: Dossier;
  gloss: string;
}) {
  const final = dossier.commits.finalCommit;
  const base = dossier.repo.htmlUrl.replace(/\/+$/, "");
  const subject = final ? final.message.split("\n")[0] : "";
  const leftoverTodo = dossier.todos.degraded ? null : dossier.todos.items[0];

  return (
    <section className="flex flex-col gap-3.5 border border-sc-border bg-sc-panel px-6 py-[22px]">
      <h2 className="font-mono text-[11px] uppercase tracking-[.26em] text-sc-dim">
        Last words
      </h2>

      {final ? (
        <>
          <div className="flex-1 border border-sc-hair bg-sc-commit p-4 text-[12px] leading-[1.75] text-sc-body2">
            <div className="mb-2 text-sc-muted">
              — final commit ·{" "}
              <a
                href={`${base}/commit/${final.sha}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sc-accent transition-colors hover:text-sc-accent-hi"
              >
                {shortSha(final.sha)}
              </a>{" "}
              · {formatDate(final.date)}
            </div>
            <div className="break-words">{subject}</div>
            {leftoverTodo ? (
              <div className="mt-2.5 break-words text-sc-quote">
                {leftoverTodo.snippet}
              </div>
            ) : null}
            <div className="mt-0.5 italic text-sc-quote">{gloss}</div>
          </div>
          <a
            href={`${base}/commit/${final.sha}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block border border-sc-border py-2.5 text-center text-[11px] uppercase tracking-[.18em] text-sc-body transition-colors hover:border-sc-border-hi hover:text-sc-ink"
          >
            View final commit ↗
          </a>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center border border-sc-hair bg-sc-commit p-6 text-center">
          <p className="font-serif text-base italic text-sc-quote">
            The ledger holds no final words.
          </p>
        </div>
      )}
    </section>
  );
}
