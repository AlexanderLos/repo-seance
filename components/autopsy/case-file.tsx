/**
 * The case file — the left column of the autopsy (DESIGN-NOTES §3). Certificate
 * full-width, then Row A (cause · decline · last words) and Row B (unfinished ·
 * revival). Collapses to a single column in spec order on narrow viewports
 * (SPEC §6). The per-request timing line is REAL client-measured elapsed, not an
 * eval statistic (SPEC §8) — so it lives with the report, not in the footer.
 */
import type { Dossier } from "@/lib/dossier/types";
import type { Autopsy } from "@/lib/autopsy/schema";
import { Certificate } from "./certificate";
import { CauseOfDeath } from "./cause-of-death";
import { DeclineChart } from "./decline-chart";
import { LastWords } from "./last-words";
import { UnfinishedBusiness } from "./unfinished-business";
import { RevivalPlan } from "./revival-plan";

export function CaseFile({
  dossier,
  autopsy,
  elapsedSeconds,
}: {
  dossier: Dossier;
  autopsy: Autopsy;
  elapsedSeconds: number | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[18px]">
      <Certificate dossier={dossier} epitaph={autopsy.epitaph} />

      <div className="grid grid-cols-1 items-stretch gap-[18px] xl:grid-cols-[1.15fr_1fr_1fr]">
        <CauseOfDeath dossier={dossier} autopsy={autopsy} />
        <DeclineChart dossier={dossier} />
        <LastWords dossier={dossier} gloss={autopsy.lastWordsGloss} />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-[18px] xl:grid-cols-[1.4fr_1fr]">
        <UnfinishedBusiness dossier={dossier} />
        <RevivalPlan dossier={dossier} autopsy={autopsy} />
      </div>

      {elapsedSeconds !== null ? (
        <div className="text-right font-mono text-[10.5px] text-sc-faint">
          Analysis completed in {elapsedSeconds.toFixed(1)}s ✓
        </div>
      ) : null}
    </div>
  );
}
