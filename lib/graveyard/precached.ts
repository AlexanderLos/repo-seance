/**
 * Reader for the committed graveyard snapshots (SPEC §6). Each famous dead repo
 * that survives the precache run is written to
 * `data/graveyard/{owner}__{repo}.json` as `{ dossier, autopsy }`, so a demo
 * click renders instantly with zero live API or LLM cost.
 *
 * Server-only: it touches the filesystem (`node:fs`). Both halves are validated
 * against their real schemas on read — a missing, malformed, or stale snapshot
 * returns null rather than poisoning the app with an invalid Dossier.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DossierSchema, type Dossier } from '../dossier/types';
import { AutopsySchema, type Autopsy } from '../autopsy/schema';

export interface PrecachedAutopsy {
  dossier: Dossier;
  autopsy: Autopsy;
}

const PrecachedSchema = z.object({
  dossier: DossierSchema,
  autopsy: AutopsySchema,
});

/** Canonical, case-insensitive snapshot filename for a repo. */
export function precachedFileName(owner: string, repo: string): string {
  return `${owner.toLowerCase()}__${repo.toLowerCase()}.json`;
}

/**
 * Directory holding the snapshots. Overridable via `GRAVEYARD_DIR` (read lazily)
 * so the precache script and tests can target a scratch location; otherwise
 * `data/graveyard/` under the process working directory.
 */
export function graveyardDir(): string {
  return process.env.GRAVEYARD_DIR ?? path.join(process.cwd(), 'data', 'graveyard');
}

/**
 * Read + validate one snapshot from an explicit directory. Pure with respect to
 * configuration (the directory is a parameter), which is what makes it testable
 * against a temp fixture.
 */
export async function readPrecachedFrom(
  dir: string,
  owner: string,
  repo: string,
): Promise<PrecachedAutopsy | null> {
  const file = path.join(dir, precachedFileName(owner, repo));
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return null; // absent
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null; // corrupt
  }
  const parsed = PrecachedSchema.safeParse(json);
  return parsed.success ? parsed.data : null; // stale / invalid
}

/** Reads the committed data/graveyard/ snapshot for instant demo clicks; null when absent. */
export async function getPrecached(
  owner: string,
  repo: string,
): Promise<PrecachedAutopsy | null> {
  return readPrecachedFrom(graveyardDir(), owner, repo);
}
