/**
 * precache-graveyard — the LIVE verifier + snapshotter for the Graveyard
 * (SPEC §6). Run explicitly (`pnpm precache`) during the integration phase, NOT
 * as part of typecheck/lint/test.
 *
 * For each curated candidate it:
 *   1. fetches repo metadata and SKIPS (with a warning) anything not actually
 *      `archived` — the curated list is allowed to be optimistic, this is the
 *      gate that keeps it honest;
 *   2. builds a fresh Dossier (cache bypassed) and generates its autopsy;
 *   3. writes `data/graveyard/{owner}__{repo}.json` as `{ dossier, autopsy }`.
 *
 * It prints a summary and exits non-zero if fewer than 10 repos survived, so a
 * degraded Graveyard fails the pipeline rather than shipping empty demo tiles.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { GitHubClient } from '../lib/github/client';
import { buildDossier } from '../lib/dossier/build';
import { getOrCreateAutopsy } from '../lib/autopsy/generate';
import { GRAVEYARD } from '../lib/graveyard/list';
import { graveyardDir, precachedFileName } from '../lib/graveyard/precached';

const MIN_SURVIVORS = 10;

interface GhArchivedFlag {
  archived: boolean;
}

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main(): Promise<void> {
  const client = new GitHubClient();
  const outDir = graveyardDir();
  await fs.mkdir(outDir, { recursive: true });

  const log: string[] = [];
  let survived = 0;

  for (const entry of GRAVEYARD) {
    const slug = `${entry.owner}/${entry.repo}`;
    try {
      const meta = await client.getJson<GhArchivedFlag>(
        `/repos/${entry.owner}/${entry.repo}`,
      );
      if (meta.archived !== true) {
        console.warn(`skip  ${slug}: not archived`);
        log.push(`SKIP ${slug} (not archived)`);
        continue;
      }

      const dossier = await buildDossier(entry.owner, entry.repo, {
        bypassCache: true,
        client,
      });
      const autopsy = await getOrCreateAutopsy(dossier);

      const file = path.join(outDir, precachedFileName(entry.owner, entry.repo));
      await fs.writeFile(
        file,
        `${JSON.stringify({ dossier, autopsy }, null, 2)}\n`,
        'utf8',
      );
      survived += 1;
      log.push(`OK   ${slug}`);
      console.log(`ok    ${slug} -> ${path.basename(file)}`);
    } catch (err) {
      console.warn(`fail  ${slug}: ${reason(err)}`);
      log.push(`FAIL ${slug} (${reason(err)})`);
    }
  }

  console.log('\n=== Graveyard precache summary ===');
  for (const line of log) console.log(line);
  console.log(`\nsurvived: ${survived}/${GRAVEYARD.length} (need >= ${MIN_SURVIVORS})`);

  if (survived < MIN_SURVIVORS) {
    console.error(
      `Only ${survived} archived repos survived; need at least ${MIN_SURVIVORS}.`,
    );
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(reason(err));
  process.exit(1);
});
