/**
 * Cause of death (DESIGN-NOTES §5.3a): a confidence-ranked list of causes from
 * the synthesized autopsy, each with a gold confidence bar and its resolved
 * evidence chips. The leading cause is echoed as the serif verdict headline. The
 * closing italic line is the deterministic death reason from the Dossier — real,
 * not invented.
 */
import type { Dossier } from "@/lib/dossier/types";
import type { Autopsy } from "@/lib/autopsy/schema";
import { EvidenceChips } from "./evidence-chips";

export function CauseOfDeath({
  dossier,
  autopsy,
}: {
  dossier: Dossier;
  autopsy: Autopsy;
}) {
  const headline = autopsy.causes[0]?.label ?? "Cause undetermined";

  return (
    <section className="flex flex-col gap-4 border border-sc-border bg-sc-panel px-6 py-[22px]">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[.26em] text-sc-dim">
          Cause of death
        </h2>
        <span className="text-[10px] text-sc-faint">confidence-ranked</span>
      </div>

      <p className="font-serif text-[27px] font-semibold leading-[1.1] text-sc-head">
        {headline}
      </p>

      <ol className="flex flex-col gap-4">
        {autopsy.causes.map((cause, i) => (
          <li key={`${i}-${cause.label}`} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] leading-[1.45] text-sc-body">
                {cause.label}
              </span>
              <span className="flex-shrink-0 font-mono text-[11px] tabular-nums text-sc-muted">
                {cause.confidencePct}%
              </span>
            </div>
            <div className="h-[3px] bg-sc-hair">
              <div
                className="h-full bg-sc-accent opacity-75"
                style={{ width: `${cause.confidencePct}%` }}
              />
            </div>
            <EvidenceChips dossier={dossier} refs={cause.evidence} />
          </li>
        ))}
      </ol>

      <p className="mt-0.5 font-serif text-base italic text-sc-quote">
        {dossier.death.reason}
      </p>
    </section>
  );
}
