/**
 * Cache key conventions and TTL (SPEC §3). The Dossier and the rendered autopsy
 * are cached separately so a repeat visit costs zero LLM calls.
 *
 * Keys interpolate owner/repo verbatim. Callers that want case-insensitive hits
 * (GitHub treats `Atom/Atom` and `atom/atom` as the same repo) should lower-case
 * owner/repo before calling.
 */

/** 24 hours, in seconds. */
export const TTL_24H = 86_400;

/** Cache key for a repository's Dossier. */
export function dossierKey(owner: string, repo: string): string {
  return `dossier:${owner}/${repo}:v1`;
}

/** Cache key for a repository's rendered autopsy analysis. */
export function autopsyKey(owner: string, repo: string): string {
  return `autopsy:${owner}/${repo}:v1`;
}
