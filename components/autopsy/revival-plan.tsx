/**
 * Revival plan (DESIGN-NOTES §5.4b): the green "hope" panel. Numbered steps and
 * effort tags come straight from the synthesized autopsy; the CTA opens the
 * repository so a would-be reviver can begin. Green tint signals the one note of
 * optimism in an otherwise funereal page.
 */
import type { Dossier } from "@/lib/dossier/types";
import type { Autopsy } from "@/lib/autopsy/schema";

const NUMERALS = ["i.", "ii.", "iii.", "iv.", "v."];

export function RevivalPlan({
  dossier,
  autopsy,
}: {
  dossier: Dossier;
  autopsy: Autopsy;
}) {
  return (
    <section className="flex flex-col gap-3.5 border border-sc-green-border bg-[linear-gradient(180deg,#10130d_0%,#0e100b_100%)] px-6 py-[22px]">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[.26em] text-sc-green-head">
          Revival plan
        </h2>
        <span className="font-mono text-[10px] text-sc-green-dim">
          {autopsy.revival.length} steps
        </span>
      </div>

      <ol className="flex flex-col gap-3">
        {autopsy.revival.map((step, i) => (
          <li key={i} className="flex items-baseline gap-3">
            <span className="flex-shrink-0 font-mono text-[11px] text-sc-green-dim">
              {NUMERALS[i] ?? `${i + 1}.`}
            </span>
            <span className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-sc-green-text">
              {step.step}
            </span>
            {/* Effort tags come from synthesis and can be a full clause ("a heroic
                quarter of legal and organisational negotiation"), not just "~2d".
                A short tag sizes to its content and hugs the right exactly as the
                mock does (DESIGN-NOTES §5.4b); a long one is capped and wraps to
                multiple lines so it never forces the row wider than the viewport
                (SPEC §6) nor starves the step text of width. */}
            <span className="max-w-[42%] shrink-0 text-right font-mono text-[10px] leading-[1.5] text-sc-green-dim [overflow-wrap:anywhere]">
              {step.effort}
            </span>
          </li>
        ))}
      </ol>

      <a
        href={dossier.repo.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open the repository to attempt a revival"
        className="mt-auto block border border-sc-green-border-hi bg-sc-green-btn py-2.5 text-center font-mono text-[11px] uppercase tracking-[.18em] text-sc-green-btn-text transition-colors hover:bg-sc-green-btn-hi hover:text-sc-green-btn-text-hi"
      >
        ⚡ Attempt resurrection
      </a>
    </section>
  );
}
