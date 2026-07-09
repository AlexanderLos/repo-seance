/**
 * The Graveyard (SPEC §1/§6): a curated grid of famous dead repos with
 * pre-cached autopsies, so a demo click is instant. Reads the frozen `GRAVEYARD`
 * list (owned by the data layer). Renders an honest, in-voice empty state while
 * the list is still being dug — never fabricated headstones.
 */
import Link from "next/link";
import { GRAVEYARD } from "@/lib/graveyard/list";

export function GraveyardGrid() {
  if (GRAVEYARD.length === 0) {
    return (
      <div className="border border-dashed border-sc-border bg-sc-panel px-6 py-10 text-center">
        <p className="font-serif text-xl italic text-sc-epitaph">
          The graveyard is still being dug.
        </p>
        <p className="mt-2 font-mono text-[11px] text-sc-faint">
          Paste an owner/repo above to hold your own séance.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {GRAVEYARD.map((entry) => (
        <li key={`${entry.owner}/${entry.repo}`}>
          <Link
            href={`/${encodeURIComponent(entry.owner)}/${encodeURIComponent(entry.repo)}`}
            className="group flex h-full flex-col gap-2 border border-sc-border bg-sc-panel px-5 py-4 transition-colors hover:border-sc-border-hi"
          >
            <span className="font-mono text-sm text-sc-body">
              {entry.owner}
              <span className="text-sc-muted">/</span>
              {entry.repo}
            </span>
            <span className="font-serif text-[15px] italic leading-snug text-sc-quote">
              {entry.blurb}
            </span>
            <span className="mt-auto pt-1 font-mono text-[10px] uppercase tracking-[.18em] text-sc-muted transition-colors group-hover:text-sc-accent">
              Hold séance ↗
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
