/**
 * Evidence chips — the enforced §4 rule made visible. Each `EvidenceRef` is run
 * through `resolveEvidence`; only refs that resolve to a real Dossier entry (and
 * therefore a real GitHub URL) become a link. A ref that doesn't resolve is
 * never rendered — the UI cannot show a chip that points at nothing.
 */
import type { Dossier } from "@/lib/dossier/types";
import type { EvidenceRef } from "@/lib/autopsy/schema";
import { resolveEvidence } from "@/lib/evidence/validate";

export function EvidenceChips({
  dossier,
  refs,
}: {
  dossier: Dossier;
  refs: EvidenceRef[];
}) {
  const resolved = refs
    .map((ref, i) => {
      const hit = resolveEvidence(dossier, ref);
      return hit ? { key: `${ref.type}:${ref.ref}:${i}`, ...hit } : null;
    })
    .filter((v): v is { key: string; url: string; label: string } => v !== null);

  if (resolved.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {resolved.map((chip) => (
        <a
          key={chip.key}
          href={chip.url}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-sc-border bg-sc-input px-[7px] py-0.5 text-[10px] text-sc-dim transition-colors hover:border-sc-border-hi hover:text-sc-accent"
        >
          {chip.label}
        </a>
      ))}
    </div>
  );
}
