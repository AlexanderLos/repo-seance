/**
 * Server-only, LLM-free lookup for metadata and the OG image (SPEC §6 item 5).
 * Checks the committed graveyard snapshot first, then the shared cache — but
 * NEVER triggers a build/fetch or an autopsy synthesis. Returns null when
 * nothing is on hand, so callers fall back to a generic tombstone. Wrapped in
 * try/catch so `generateMetadata` and the image route can never throw.
 */
import { getPrecached } from "@/lib/graveyard/precached";
import { getCache } from "@/lib/cache";
import { dossierKey, autopsyKey } from "@/lib/cache/keys";
import type { Dossier } from "@/lib/dossier/types";
import type { Autopsy } from "@/lib/autopsy/schema";

export interface CachedAutopsy {
  dossier: Dossier;
  autopsy: Autopsy | null;
}

export async function lookupCachedAutopsy(
  owner: string,
  repo: string,
): Promise<CachedAutopsy | null> {
  try {
    const precached = await getPrecached(owner, repo);
    if (precached) {
      return { dossier: precached.dossier, autopsy: precached.autopsy };
    }

    const cache = getCache();
    const lo = owner.toLowerCase();
    const lr = repo.toLowerCase();
    const dossier = await cache.get<Dossier>(dossierKey(lo, lr));
    if (!dossier) return null;
    const autopsy = await cache.get<Autopsy>(autopsyKey(lo, lr));
    return { dossier, autopsy: autopsy ?? null };
  } catch {
    return null;
  }
}
