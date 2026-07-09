import type { Metadata } from "next";
import { SeanceShell } from "@/components/seance-shell";
import { ExhumeBar } from "@/components/exhume-bar";
import { GraveyardGrid } from "@/components/graveyard-grid";
import { Flame } from "@/components/flame";

export const metadata: Metadata = {
  title: "Repo Séance — forensics for dead code",
  description:
    "Paste an abandoned GitHub repository. Receive its death certificate — cause of death, last words, unfinished business. Then interrogate its ghost.",
};

const STEPS = [
  {
    n: "i.",
    title: "Exhume",
    body: "Paste an owner/repo or a GitHub URL. We read the commit ledger, the branches, the abandoned issues — server-side, never the client.",
  },
  {
    n: "ii.",
    title: "Read the certificate",
    body: "A death certificate: cause of death, confidence-ranked and evidence-linked. A decline chart. Its last words. The business it never finished.",
  },
  {
    n: "iii.",
    title: "Interrogate the ghost",
    body: "Ask it anything. Every answer cites a real commit, issue, or branch — or it refuses. The ghost does not invent.",
  },
];

export default function Home() {
  return (
    <SeanceShell active="home">
      {/* Hero — the thesis of the whole app. */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-16 sm:px-7 sm:pt-24">
        <div className="flex items-center gap-3">
          <Flame size={18} />
          <p className="font-mono text-[10px] uppercase tracking-[.32em] text-sc-muted">
            Certificate of repository death
          </p>
        </div>
        <h1 className="mt-6 max-w-3xl text-balance font-serif text-5xl font-medium leading-[1.05] text-sc-head sm:text-6xl">
          Every dead repository leaves a body.
        </h1>
        <p className="mt-6 max-w-xl font-serif text-xl italic leading-relaxed text-sc-epitaph">
          Paste an abandoned GitHub repo. Receive its death certificate — cause
          of death, last words, the unfinished business it left behind. Then
          speak with its ghost.
        </p>
        <div className="mt-9 max-w-xl">
          <ExhumeBar size="lg" autoFocus />
          <p className="mt-3 font-mono text-[11px] text-sc-faint">
            Public repositories only · nothing is written back · the dead do not
            mind being read.
          </p>
        </div>
      </section>

      {/* How it works. */}
      <section
        id="how-it-works"
        className="scroll-mt-20 border-t border-sc-hair bg-sc-bg/40"
      >
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-7">
          <h2 className="font-mono text-[11px] uppercase tracking-[.26em] text-sc-dim">
            How it works
          </h2>
          <ol className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="flex flex-col gap-3">
                <span className="font-mono text-sm text-sc-accent">{step.n}</span>
                <h3 className="font-serif text-2xl text-sc-head">{step.title}</h3>
                <p className="font-mono text-[12.5px] leading-relaxed text-sc-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The Graveyard. */}
      <section
        id="graveyard"
        className="scroll-mt-20 border-t border-sc-hair"
      >
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-7">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[.26em] text-sc-dim">
              The Graveyard
            </h2>
            <span className="font-mono text-[10px] text-sc-faint">
              curated · pre-cached · instant
            </span>
          </div>
          <p className="mt-4 max-w-xl font-serif text-lg italic text-sc-quote">
            Famous repositories that have gone quiet. Pay your respects — the
            autopsies are already prepared.
          </p>
          <div className="mt-8">
            <GraveyardGrid />
          </div>
        </div>
      </section>
    </SeanceShell>
  );
}
