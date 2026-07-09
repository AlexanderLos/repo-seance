/**
 * The living-repo page (SPEC §3/§6): a distinct, playful surface for a repo that
 * is still breathing. Vitals shown, NO death certificate, and an invite to the
 * Graveyard. We never fabricate a death for a living project.
 */
import Link from "next/link";
import type { Dossier } from "@/lib/dossier/types";
import { formatDate, formatLastPulse, formatCount } from "../util/format";

/** A steady, full-amplitude pulse — no flatline. */
function LivePulse() {
  return (
    <svg
      viewBox="0 0 600 40"
      preserveAspectRatio="none"
      className="block h-10 w-full"
      aria-hidden="true"
    >
      <polyline
        points="0,20 80,20 96,6 112,34 128,20 200,20 216,6 232,34 248,20 320,20 336,6 352,34 368,20 440,20 456,6 472,34 488,20 560,20 600,20"
        fill="none"
        stroke="var(--color-sc-green-head)"
        strokeWidth="1.5"
        opacity="0.9"
      />
    </svg>
  );
}

export function AliveState({ dossier }: { dossier: Dossier }) {
  const { repo, death } = dossier;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-7">
      <div className="border border-sc-green-border bg-[linear-gradient(180deg,#10130d_0%,#0e100b_100%)] px-6 py-10 sm:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[.32em] text-sc-green-dim">
          Séance declined · subject is alive
        </p>
        <h1 className="mt-5 font-serif text-4xl text-sc-head sm:text-5xl">
          {repo.owner}
          <span className="text-sc-muted">/</span>
          {repo.name}
        </h1>
        <p className="mt-4 font-serif text-xl italic leading-relaxed text-sc-green-text">
          This one still breathes. There is nothing to exhume — come back when
          it has gone quiet.
        </p>

        <div className="mt-8">
          <LivePulse />
        </div>

        {repo.description ? (
          <p className="mt-6 text-[13px] leading-relaxed text-sc-body">
            {repo.description}
          </p>
        ) : null}

        <dl className="mt-8 grid grid-cols-2 gap-x-7 gap-y-4 border-t border-sc-hair pt-6 text-[12px] sm:grid-cols-4">
          <div>
            <dt className="text-[10px] uppercase tracking-[.18em] text-sc-faint">
              Born
            </dt>
            <dd className="mt-1 text-sc-body">{formatDate(repo.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[.18em] text-sc-faint">
              Last pulse
            </dt>
            <dd className="mt-1 text-sc-body">{formatLastPulse(death.daysSincePush)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[.18em] text-sc-faint">
              Stars
            </dt>
            <dd className="mt-1 tabular-nums text-sc-body">
              {formatCount(repo.stars)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[.18em] text-sc-faint">
              Forks
            </dt>
            <dd className="mt-1 tabular-nums text-sc-body">
              {formatCount(repo.forks)}
            </dd>
          </div>
        </dl>

        <div className="mt-9 flex flex-wrap gap-3">
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-sc-green-border-hi bg-sc-green-btn px-6 py-3 font-mono text-[11px] uppercase tracking-[.18em] text-sc-green-btn-text transition-colors hover:bg-sc-green-btn-hi hover:text-sc-green-btn-text-hi"
          >
            Visit the living ↗
          </a>
          <Link
            href="/#graveyard"
            className="border border-sc-border px-6 py-3 font-mono text-[11px] uppercase tracking-[.18em] text-sc-body transition-colors hover:border-sc-border-hi hover:text-sc-ink"
          >
            Wander the Graveyard
          </Link>
        </div>
      </div>
    </div>
  );
}
