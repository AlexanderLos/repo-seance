/**
 * Parse whatever the user pastes into the Exhume field into a GitHub
 * `{ owner, repo }` slug. Accepts a bare `owner/repo`, a `github.com/...` URL
 * (any scheme, with or without `www`, `.git`, trailing path, or scp syntax).
 * Returns null for anything that isn't recognizably an owner/repo pair — the
 * caller shows an in-voice hint rather than navigating nowhere.
 *
 * Pure and dependency-free so it can be unit-tested directly (tests/ui-slug).
 */

export interface RepoSlug {
  owner: string;
  repo: string;
}

/** GitHub logins: 1–39 chars of alphanumerics and single hyphens. */
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
/** Repo names: alphanumerics plus `.`, `_`, `-` (GitHub's allowed set). */
const REPO_RE = /^[A-Za-z0-9._-]+$/;

function isValidOwner(owner: string): boolean {
  return OWNER_RE.test(owner);
}

function isValidRepo(repo: string): boolean {
  // A lone "." or ".." is never a real repo path segment.
  return repo !== "." && repo !== ".." && REPO_RE.test(repo);
}

export function parseRepoInput(raw: string): RepoSlug | null {
  if (typeof raw !== "string") return null;

  let s = raw.trim();
  if (s === "") return null;

  // Strip a leading scheme (https://, http://, git://, ssh://) and scp `git@`.
  s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  s = s.replace(/^git@/i, "");

  // Strip a leading github host, for both `host/owner` and scp `host:owner`.
  s = s.replace(/^(?:www\.)?github\.com[/:]/i, "");

  // Drop a query string or fragment if one rode along.
  s = s.replace(/[?#].*$/, "");

  // Split on slashes, dropping empties from leading/trailing/duplicate slashes.
  const parts = s.split("/").filter((p) => p.length > 0);
  if (parts.length < 2) return null;

  const owner = parts[0];
  let repo = parts[1];

  // A `.git` suffix is a clone URL habit, not part of the repo name.
  repo = repo.replace(/\.git$/i, "");

  if (!isValidOwner(owner) || !isValidRepo(repo)) return null;
  return { owner, repo };
}

/** Build the canonical in-app path for a slug. */
export function repoPath(slug: RepoSlug): string {
  return `/${encodeURIComponent(slug.owner)}/${encodeURIComponent(slug.repo)}`;
}
