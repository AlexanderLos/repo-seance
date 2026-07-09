/**
 * The exhumation loader (SPEC §6). Three phases narrated in order and advanced
 * by REAL NDJSON stage lines from /api/exhume — not a timer. The active phase
 * glows; completed phases are marked; pending phases wait in the dark.
 */
import type { RitualStage } from "@/app/api/exhume/protocol";
import { Flame } from "../flame";
import { cn } from "../util/cn";

const PHASES: { stage: RitualStage; label: string }[] = [
  { stage: "locating", label: "Locating remains" },
  { stage: "ledger", label: "Reading the commit ledger" },
  { stage: "contacting", label: "Contacting the departed" },
];

const ORDER: Record<RitualStage, number> = {
  locating: 0,
  ledger: 1,
  contacting: 2,
};

export function RitualLoader({ stage }: { stage: RitualStage }) {
  const current = ORDER[stage];

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <Flame size={30} drift />
      <p className="mt-6 font-serif text-2xl italic text-sc-epitaph">
        Conducting the séance…
      </p>

      <ol className="mt-10 flex w-full flex-col gap-4">
        {PHASES.map((phase, i) => {
          const done = i < current;
          const activeNow = i === current;
          return (
            <li
              key={phase.stage}
              className="flex items-center gap-3 font-mono text-[13px]"
              aria-current={activeNow ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-4 w-4 flex-shrink-0 items-center justify-center text-[10px]",
                  done && "text-sc-accent",
                  activeNow && "text-sc-accent-hi",
                  !done && !activeNow && "text-sc-faint",
                )}
                aria-hidden="true"
              >
                {done ? "✓" : activeNow ? "◈" : "·"}
              </span>
              <span
                className={cn(
                  "tracking-[.04em] transition-colors",
                  done && "text-sc-muted",
                  activeNow && "animate-flicker text-sc-body motion-reduce:animate-none",
                  !done && !activeNow && "text-sc-faint",
                )}
              >
                {phase.label}
                {activeNow ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-10 font-mono text-[11px] text-sc-faint">
        Reading the ledger server-side. The dead keep their own time.
      </p>
    </div>
  );
}
