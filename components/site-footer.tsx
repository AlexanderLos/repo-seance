/**
 * The trust footer (SPEC §7, DESIGN-NOTES §8). Every number here is READ from
 * `evals/results.json` at server/build time — never hand-typed (the CI grep
 * gate, scripts/check-hardcoded-stats.mjs, fails the build otherwise). When the
 * artifact is absent or the suite is failing, the footer says so in-voice and
 * shows no green claim. The per-request "analysis completed in Xs" line is NOT
 * here — that is real client-measured timing, rendered with the report.
 */
import { readEvalResults, footerView } from "./util/results";

function Dot() {
  return <span aria-hidden="true">·</span>;
}

export function SiteFooter() {
  const view = footerView(readEvalResults());

  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-sc-hair px-4 py-3.5 font-mono text-[11px] text-sc-faint sm:px-7">
      <span>Séance Engine v2.4.1</span>

      {view.present ? (
        view.verified ? (
          <>
            <Dot />
            <span>
              {view.passed}/{view.total} evals passing
            </span>
            <Dot />
            <span>{view.citePct}% of claims cite direct evidence</span>
            <Dot />
            <span>
              {view.hallucinationCount} hallucination
              {view.hallucinationCount === 1 ? "" : "s"} across {view.total} eval
              cases
            </span>
          </>
        ) : (
          <>
            <Dot />
            <span>
              {view.passed}/{view.total} evals passing
            </span>
            <Dot />
            <span className="text-sc-danger-text">
              the séance is not yet clean — the numbers are still settling
            </span>
          </>
        )
      ) : (
        <>
          <Dot />
          <span>the séance is unverified — the eval results have not spoken</span>
        </>
      )}
    </footer>
  );
}
