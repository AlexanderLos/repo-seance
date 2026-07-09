/**
 * Decline (DESIGN-NOTES §5.3b / §7.2): the commits-per-month bar chart, driven
 * by real Dossier data via `buildDeclineChart`. Bars are colored alive / decay /
 * dead around the deterministic flatline; the mock's lone 🕯 is replaced by the
 * inline SVG flame atop the flatline marker (SPEC §6). Caption states an honest,
 * data-derived cadence figure — never the mock's invented percentage.
 */
import type { Dossier } from "@/lib/dossier/types";
import { buildDeclineChart, declineCaption, type DeclineZone } from "../util/decline";
import { formatMonthLabel } from "../util/format";
import { Flame } from "../flame";

function zoneClass(zone: DeclineZone): string {
  switch (zone) {
    case "dead":
      return "bg-sc-hair";
    case "decay":
      return "bg-[#4a3c20]";
    default:
      return "bg-[rgba(201,151,63,.55)]";
  }
}

export function DeclineChart({ dossier }: { dossier: Dossier }) {
  const nowMonth = dossier.fetchedAt.slice(0, 7);
  const chart = buildDeclineChart({
    monthly: dossier.commits.monthly,
    flatlineMonth: dossier.death.flatlineMonth,
    nowMonth,
  });
  const caption = declineCaption({
    monthly: dossier.commits.monthly,
    flatlineMonth: dossier.death.flatlineMonth,
    daysSincePush: dossier.death.daysSincePush,
  });

  return (
    <section className="flex flex-col border border-sc-border bg-sc-panel px-6 py-[22px]">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[.26em] text-sc-dim">
          Decline
        </h2>
        <span className="text-[10px] text-sc-faint">commits / month</span>
      </div>

      {chart.empty ? (
        <div className="flex min-h-[150px] flex-1 items-center justify-center px-2 text-center">
          <p className="font-serif text-base italic text-sc-quote">
            No cadence to chart — the ledger came back empty.
          </p>
        </div>
      ) : (
        <>
          <div className="relative flex min-h-[150px] flex-1 items-end gap-[2px] pt-[18px]">
            {chart.bars.map((bar) => (
              <div
                key={bar.month}
                title={`${formatMonthLabel(bar.month)} · ${bar.count} commit${bar.count === 1 ? "" : "s"}`}
                className={`min-h-[1px] flex-1 ${zoneClass(bar.zone)}`}
                style={{ height: `${bar.heightPct}%` }}
              />
            ))}
            {chart.markerLeftPct !== null ? (
              <>
                <div
                  className="absolute bottom-0 top-0 border-l border-dashed border-sc-danger-line"
                  style={{ left: `${chart.markerLeftPct}%` }}
                  aria-hidden="true"
                />
                <div
                  className="absolute top-[-6px] -translate-x-1/2"
                  style={{ left: `${chart.markerLeftPct}%` }}
                  aria-hidden="true"
                >
                  <Flame size={13} drift />
                </div>
              </>
            ) : null}
          </div>

          {chart.years.length > 0 ? (
            <div className="mt-2 flex justify-between text-[10px] tabular-nums text-sc-faint">
              {chart.years.map((year) => (
                <span
                  key={year.label}
                  className={year.dagger ? "text-sc-danger-text" : undefined}
                >
                  {year.label}
                  {year.dagger ? " †" : ""}
                </span>
              ))}
            </div>
          ) : null}
        </>
      )}

      <p className="mt-3.5 border-t border-sc-hair pt-3.5 text-[11.5px] leading-[1.6] text-sc-dim">
        {caption}
      </p>
    </section>
  );
}
