/**
 * The death certificate (DESIGN-NOTES §5.2): the framed "document" with its
 * double-rule border, the repo's identity and epitaph, an inline vitals row,
 * the rotated DECEASED rubber stamp, and the heartbeat strip with its flatline
 * marker. Every value is straight from the Dossier / synthesized autopsy — the
 * numbers are eval-tested (SPEC §7). Text is rendered through React (escaped).
 */
import type { Dossier } from "@/lib/dossier/types";
import {
  formatDate,
  formatAge,
  formatDays,
  formatCount,
  formatMonthLabel,
  caseNumber,
} from "../util/format";

/** Decorative EKG motif from the mock — a weakening pulse into a flatline. */
function Heartbeat() {
  return (
    <svg
      viewBox="0 0 600 36"
      preserveAspectRatio="none"
      className="block h-9 flex-1"
      aria-hidden="true"
    >
      <polyline
        points="0,18 60,18 70,8 80,30 90,18 150,18 160,10 170,27 180,18 250,18 262,13 274,24 286,18 360,18 372,16 384,21 396,18 600,18"
        fill="none"
        stroke="var(--color-sc-accent)"
        strokeWidth="1.5"
        opacity="0.85"
      />
      <line
        x1="420"
        y1="4"
        x2="420"
        y2="32"
        stroke="var(--color-sc-danger-line)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

export function Certificate({
  dossier,
  epitaph,
}: {
  dossier: Dossier;
  epitaph: string;
}) {
  const { repo, death } = dossier;
  const dying = death.status === "dying";
  const stampLabel = dying ? "Fading" : "Deceased";
  const confirmLabel = dying
    ? `Fading · ${formatDays(death.daysSincePush)} quiet`
    : `Confirmed · ${formatDays(death.daysSincePush)} silent`;

  return (
    <section className="relative overflow-hidden border border-sc-border bg-[linear-gradient(180deg,#14110a_0%,#100d08_100%)] px-6 py-8 sm:px-10 sm:pb-[30px] sm:pt-[34px]">
      {/* Inner double-rule frame. */}
      <div
        className="pointer-events-none absolute inset-[6px] border border-sc-hair"
        aria-hidden="true"
      />

      <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[.32em] text-sc-muted">
            Certificate of repository death · Case No. {caseNumber(repo.fullName)}
          </div>
          <h1 className="mt-3 font-serif text-4xl font-medium leading-[1.05] text-sc-head sm:text-[52px]">
            {repo.owner}
            <span className="text-sc-muted">/</span>
            {repo.name}
          </h1>
          <p className="mt-3.5 max-w-xl font-serif text-[21px] italic leading-[1.45] text-sc-epitaph">
            {epitaph}
          </p>
          <dl className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-[12px] text-sc-dim">
            <div>
              <dt className="inline text-sc-faint">Born</dt>{" "}
              <dd className="inline">{formatDate(repo.createdAt)}</dd>
            </div>
            <div>
              <dt className="inline text-sc-faint">Died</dt>{" "}
              <dd className="inline">{formatDate(repo.pushedAt)}</dd>
            </div>
            <div>
              <dt className="inline text-sc-faint">Age</dt>{" "}
              <dd className="inline">
                {formatAge(repo.createdAt, repo.pushedAt)}
              </dd>
            </div>
            <div>
              <dt className="inline text-sc-faint">Survived by</dt>{" "}
              <dd className="inline">
                {formatCount(repo.stars)} stars · {formatCount(repo.forks)} forks
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-shrink-0 flex-col items-start gap-3.5 sm:items-center">
          <div className="animate-flicker rotate-[-9deg] border-[3px] border-double border-sc-danger-line px-6 py-2.5 text-xl uppercase tracking-[.3em] text-sc-danger opacity-90 motion-reduce:animate-none">
            {stampLabel}
          </div>
          <div className="text-[10px] uppercase tracking-[.18em] text-sc-faint">
            {confirmLabel}
          </div>
        </div>
      </div>

      {/* Vitals strip. */}
      <div className="mt-6 flex items-center gap-4 border-t border-sc-hair pt-[18px]">
        <span className="flex-shrink-0 text-[10px] uppercase tracking-[.24em] text-sc-muted">
          Vitals
        </span>
        <Heartbeat />
        {death.flatlineMonth ? (
          <span className="flex-shrink-0 text-[11px] text-sc-danger-text">
            flatline · {formatMonthLabel(death.flatlineMonth)}
          </span>
        ) : null}
      </div>
    </section>
  );
}
