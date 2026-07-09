/**
 * buildDossier — assemble the one typed structure the rest of the app (and the
 * LLM) ever sees (SPEC §3). Every GitHub call flows through one rate-limit-aware
 * `GitHubClient`; the deterministic death verdict comes from `determineDeath`,
 * never the LLM; and the finished object is validated with `DossierSchema.parse`
 * before it is cached or returned.
 *
 * Resolution order (unless `bypassCache`):
 *   1. the Dossier cache (`dossier:{owner}/{repo}:v1`, 24h);
 *   2. a committed graveyard snapshot (write-through into the cache);
 *   3. a live build, firing `onStage` for meta → commits → branches → issues →
 *      readme → todos in that order.
 *
 * The `DossierStage` type and the `buildDossier(owner, repo, opts?)` signature
 * are the frozen cross-team contract; extra `opts` fields are additive and used
 * only for injection (tests) and the precache script.
 */
import type { CacheStore } from '../cache';
import { getCache } from '../cache';
import { dossierKey, TTL_24H } from '../cache/keys';
import { GitHubClient, lastPageFromLink, type FetchLike } from '../github/client';
import { GitHubRateLimitError } from '../github/errors';
import { getPrecached } from '../graveyard/precached';
import { determineDeath } from './death';
import {
  DossierSchema,
  type BranchInfo,
  type BranchesSection,
  type CommitInfo,
  type CommitsSection,
  type Dossier,
  type IssueInfo,
  type IssuesSection,
  type MonthlyBucket,
  type ReadmeSection,
  type RepoMeta,
  type TodosSection,
} from './types';

export type DossierStage =
  | 'meta'
  | 'commits'
  | 'branches'
  | 'issues'
  | 'readme'
  | 'todos';

export interface BuildDossierOptions {
  /** Progress callback, fired once at the start of each fetch stage in order. */
  onStage?: (stage: DossierStage) => void;
  /** Pre-built client (shares one rate-limit budget); else one is constructed. */
  client?: GitHubClient;
  /** Fetch implementation for a client constructed here (test injection). */
  fetch?: FetchLike;
  /** Cache store; defaults to the process-wide `getCache()` singleton. */
  cache?: CacheStore;
  /** Clock factory for the death verdict / `fetchedAt` (test determinism). */
  now?: () => Date;
  /** Skip both cache and precache short-circuits and rebuild live. */
  bypassCache?: boolean;
}

// ---------------------------------------------------------------------------
// GitHub response shapes — only the fields we actually read (strict, no `any`).
// ---------------------------------------------------------------------------

interface GhOwner {
  login: string;
}
interface GhLicense {
  spdx_id: string | null;
  name: string | null;
}
interface GhRepo {
  name: string;
  full_name: string;
  owner: GhOwner;
  description: string | null;
  html_url: string;
  created_at: string;
  pushed_at: string;
  archived: boolean;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  license: GhLicense | null;
  open_issues_count: number;
}
interface GhSignature {
  name?: string;
  date?: string;
}
interface GhCommitDetail {
  message: string;
  author?: GhSignature;
  committer?: GhSignature;
}
interface GhCommit {
  sha: string;
  commit: GhCommitDetail;
  author: GhOwner | null;
}
interface GhBranchRef {
  name: string;
  commit: { sha: string; url: string };
}
interface GhCompare {
  ahead_by: number;
  behind_by: number;
}
interface GhLabel {
  name: string;
}
interface GhIssue {
  number: number;
  title: string;
  state: string;
  created_at: string;
  closed_at: string | null;
  comments: number;
  labels: Array<GhLabel | string>;
  pull_request?: unknown;
}
interface GhComment {
  created_at: string;
}
interface GhSearchItem {
  path: string;
  text_matches?: Array<{ fragment: string }>;
}
interface GhSearchResult {
  total_count: number;
  items: GhSearchItem[];
}

// ---------------------------------------------------------------------------
// Tunables (SPEC §3).
// ---------------------------------------------------------------------------

const PER_PAGE = 100;
const MAX_COMMIT_PAGES = 10; // → 1,000 commit cap
const MAX_ISSUE_PAGES = 2; // → 200 newest issues
const MAX_BRANCHES = 10;
const MAX_MEDIAN_PROBES = 50;
const README_LIMIT = 8192; // ~8KB
const SNIPPET_LIMIT = 240;
const TODO_LIMIT = 30;
const MSG_LINE_LIMIT = 200;
const DAY_MS = 86_400_000;
const ONE_YEAR_DAYS = 365;

// ---------------------------------------------------------------------------
// Small pure helpers.
// ---------------------------------------------------------------------------

async function readJson<T>(res: Response): Promise<T> {
  const raw: unknown = await res.json();
  return raw as T;
}

/** `YYYY-MM` bucket key in UTC — month boundaries follow Zulu, not local time. */
export function monthKeyUtc(iso: string): string {
  const d = new Date(iso);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** First line of a commit message, hard-capped so a citation stays a citation. */
export function firstLine(message: string, limit = MSG_LINE_LIMIT): string {
  const line = message.split('\n', 1)[0] ?? '';
  return line.length > limit ? line.slice(0, limit) : line;
}

function commitDate(c: GhCommit, fallback: string): string {
  return c.commit.committer?.date ?? c.commit.author?.date ?? fallback;
}

function toCommitInfo(c: GhCommit, fallbackDate: string, fullMessage: boolean): CommitInfo {
  return {
    sha: c.sha,
    message: fullMessage ? c.commit.message : firstLine(c.commit.message),
    date: commitDate(c, fallbackDate),
    authorName: c.commit.author?.name ?? c.commit.committer?.name ?? 'unknown',
    authorLogin: c.author?.login ?? null,
  };
}

function mapLicense(license: GhLicense | null): string | null {
  if (!license) return null;
  if (license.spdx_id && license.spdx_id !== 'NOASSERTION') return license.spdx_id;
  return license.name ?? null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Stage fetchers.
// ---------------------------------------------------------------------------

async function fetchMeta(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<RepoMeta> {
  const r = await client.getJson<GhRepo>(`/repos/${owner}/${repo}`);
  return {
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    htmlUrl: r.html_url,
    createdAt: r.created_at,
    pushedAt: r.pushed_at,
    archived: r.archived,
    stars: r.stargazers_count,
    forks: r.forks_count,
    defaultBranch: r.default_branch,
    license: mapLicense(r.license),
  };
}

function emptyCommits(): CommitsSection {
  return {
    totalCount: 0,
    fetchedCount: 0,
    capped: false,
    monthly: [],
    recent: [],
    finalCommit: null,
  };
}

async function fetchCommits(
  client: GitHubClient,
  owner: string,
  repo: string,
  defaultBranch: string,
  fallbackDate: string,
): Promise<CommitsSection> {
  const shaQuery = `sha=${encodeURIComponent(defaultBranch)}`;

  // Cheap total via the per_page=1 Link `rel="last"` trick.
  let totalKnown = false;
  let totalCount = 0;
  const probe = await client.request(
    `/repos/${owner}/${repo}/commits?${shaQuery}&per_page=1`,
  );
  if (probe.status === 409) {
    return emptyCommits(); // empty repository
  }
  if (probe.ok) {
    const last = lastPageFromLink(probe.headers.get('link'));
    if (last !== null) {
      totalCount = last;
      totalKnown = true;
    } else {
      const one = await readJson<GhCommit[]>(probe);
      totalCount = one.length; // 0 or 1
      totalKnown = true;
    }
  }

  // Paginate newest → oldest, capped at MAX_COMMIT_PAGES × PER_PAGE.
  const all: GhCommit[] = [];
  let pages = 0;
  let lastPageFull = false;
  for (let page = 1; page <= MAX_COMMIT_PAGES; page += 1) {
    const res = await client.request(
      `/repos/${owner}/${repo}/commits?${shaQuery}&per_page=${PER_PAGE}&page=${page}`,
    );
    if (res.status === 409) break; // empty repo
    if (!res.ok) break; // transient already retried by the client; stop gracefully
    const batch = await readJson<GhCommit[]>(res);
    pages = page;
    all.push(...batch);
    lastPageFull = batch.length === PER_PAGE;
    if (!lastPageFull) break;
  }

  const fetchedCount = all.length;
  if (!totalKnown || totalCount < fetchedCount) totalCount = fetchedCount;
  const hitPageCap = pages === MAX_COMMIT_PAGES && lastPageFull;
  const capped = (totalKnown && totalCount > fetchedCount) || hitPageCap;

  const buckets = new Map<string, number>();
  for (const c of all) {
    const key = monthKeyUtc(commitDate(c, fallbackDate));
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const monthly: MonthlyBucket[] = [...buckets.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

  const recent = all.slice(0, 30).map((c) => toCommitInfo(c, fallbackDate, false));
  const finalCommit =
    all.length > 0 ? toCommitInfo(all[0], fallbackDate, true) : null;

  return { totalCount, fetchedCount, capped, monthly, recent, finalCommit };
}

async function branchLastCommitDate(
  client: GitHubClient,
  owner: string,
  repo: string,
  sha: string,
): Promise<string | null> {
  const res = await client.request(`/repos/${owner}/${repo}/commits/${sha}`);
  if (!res.ok) return null;
  const c = await readJson<GhCommit>(res);
  return c.commit.committer?.date ?? c.commit.author?.date ?? null;
}

async function branchAheadBehind(
  client: GitHubClient,
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<{ aheadBy: number | null; behindBy: number | null }> {
  try {
    const res = await client.request(
      `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    );
    if (!res.ok) return { aheadBy: null, behindBy: null };
    const cmp = await readJson<GhCompare>(res);
    return { aheadBy: cmp.ahead_by, behindBy: cmp.behind_by };
  } catch (err) {
    if (err instanceof GitHubRateLimitError) throw err;
    return { aheadBy: null, behindBy: null };
  }
}

async function fetchBranches(
  client: GitHubClient,
  owner: string,
  repo: string,
  defaultBranch: string,
  finalCommit: CommitInfo | null,
): Promise<BranchesSection> {
  let raw: GhBranchRef[];
  try {
    raw = await client.getJson<GhBranchRef[]>(
      `/repos/${owner}/${repo}/branches?per_page=${PER_PAGE}`,
    );
  } catch (err) {
    if (err instanceof GitHubRateLimitError) throw err;
    return { items: [], capped: false };
  }

  const capped = raw.length > MAX_BRANCHES;
  const kept = raw.slice(0, MAX_BRANCHES);
  const items: BranchInfo[] = [];

  for (const b of kept) {
    if (b.name === defaultBranch) {
      // The default branch's HEAD is the newest commit we already captured; no
      // extra calls, and ahead/behind against itself is 0/0 by definition.
      if (finalCommit === null) continue;
      items.push({
        name: b.name,
        lastCommitDate: finalCommit.date,
        aheadBy: 0,
        behindBy: 0,
      });
      continue;
    }

    let lastCommitDate: string | null;
    try {
      lastCommitDate = await branchLastCommitDate(client, owner, repo, b.commit.sha);
    } catch (err) {
      if (err instanceof GitHubRateLimitError) throw err;
      lastCommitDate = null;
    }
    // lastCommitDate is non-nullable in the schema; a branch we cannot date is
    // one we cannot honestly cite, so it is dropped rather than faked.
    if (lastCommitDate === null) continue;

    const { aheadBy, behindBy } = await branchAheadBehind(
      client,
      owner,
      repo,
      defaultBranch,
      b.name,
    );
    items.push({ name: b.name, lastCommitDate, aheadBy, behindBy });
  }

  return { items, capped };
}

function toIssueInfo(i: GhIssue): IssueInfo {
  return {
    number: i.number,
    title: i.title,
    state: i.state === 'closed' ? 'closed' : 'open',
    createdAt: i.created_at,
    closedAt: i.closed_at,
    comments: i.comments,
    labels: i.labels.map((l) => (typeof l === 'string' ? l : l.name)),
  };
}

async function medianFirstResponseDays(
  client: GitHubClient,
  owner: string,
  repo: string,
  issues: IssueInfo[],
): Promise<number | null> {
  // Newest issues that actually have a comment to measure against.
  const candidates = issues
    .filter((i) => i.comments > 0)
    .slice(0, MAX_MEDIAN_PROBES);
  const days: number[] = [];

  for (const issue of candidates) {
    try {
      const res = await client.request(
        `/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=1&sort=created&direction=asc`,
      );
      if (!res.ok) continue;
      const comments = await readJson<GhComment[]>(res);
      const first = comments[0]?.created_at;
      if (!first) continue;
      const delta =
        (Date.parse(first) - Date.parse(issue.createdAt)) / DAY_MS;
      if (Number.isFinite(delta) && delta >= 0) days.push(delta);
    } catch (err) {
      // A tight rate budget is an honest reason to report "unknown" (null),
      // never a fabricated number.
      if (err instanceof GitHubRateLimitError) return null;
      // Other per-issue failures just skip that issue.
    }
  }

  return days.length > 0 ? round1(median(days)) : null;
}

async function fetchIssues(
  client: GitHubClient,
  owner: string,
  repo: string,
  now: Date,
): Promise<IssuesSection> {
  const raw: GhIssue[] = [];
  let lastPageFull = false;
  let pages = 0;
  for (let page = 1; page <= MAX_ISSUE_PAGES; page += 1) {
    const res = await client.request(
      `/repos/${owner}/${repo}/issues?state=all&per_page=${PER_PAGE}&page=${page}&sort=created&direction=desc`,
    );
    if (!res.ok) break;
    const batch = await readJson<GhIssue[]>(res);
    pages = page;
    raw.push(...batch);
    lastPageFull = batch.length === PER_PAGE;
    if (!lastPageFull) break;
  }
  const capped = pages === MAX_ISSUE_PAGES && lastPageFull;

  // Pull requests share the /issues feed; the `pull_request` key filters them.
  const issues = raw
    .filter((i) => i.pull_request === undefined)
    .map(toIssueInfo);

  // openCount is the count of open, non-PR issues in the fetched (≤200) window.
  // This is exact when the repo has ≤200 issues+PRs and a lower bound above
  // that — an honest approximation rather than meta's PR-contaminated count.
  const openIssues = issues.filter((i) => i.state === 'open');
  const openCount = openIssues.length;
  const openOverOneYearNoReply = openIssues.filter(
    (i) =>
      i.comments === 0 &&
      (now.getTime() - Date.parse(i.createdAt)) / DAY_MS > ONE_YEAR_DAYS,
  ).length;

  const medianDaysToFirstResponse = await medianFirstResponseDays(
    client,
    owner,
    repo,
    issues,
  );

  return {
    items: issues,
    stats: {
      openCount,
      totalFetched: issues.length,
      medianDaysToFirstResponse,
      openOverOneYearNoReply,
    },
    capped,
  };
}

async function fetchReadme(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<ReadmeSection> {
  try {
    const res = await client.request(`/repos/${owner}/${repo}/readme`, {
      headers: { Accept: 'application/vnd.github.raw' },
    });
    if (!res.ok) return { excerpt: null, truncated: false }; // 404 = no README
    const text = await res.text();
    const truncated = text.length > README_LIMIT;
    return {
      excerpt: truncated ? text.slice(0, README_LIMIT) : text,
      truncated,
    };
  } catch (err) {
    if (err instanceof GitHubRateLimitError) throw err;
    return { excerpt: null, truncated: false };
  }
}

async function fetchTodos(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<TodosSection> {
  // Code search has its own tight budget and can be disabled entirely; ANY
  // failure (403/422/rate-limit/network) degrades to an honest empty state —
  // the TODOs tab must never show fabricated entries (SPEC §3).
  try {
    const q = encodeURIComponent(`TODO OR FIXME repo:${owner}/${repo}`);
    const res = await client.request(
      `/search/code?q=${q}&per_page=${TODO_LIMIT}`,
      { headers: { Accept: 'application/vnd.github.text-match+json' } },
    );
    if (!res.ok) return { items: [], degraded: true };
    const data = await readJson<GhSearchResult>(res);
    const items = data.items.slice(0, TODO_LIMIT).map((it) => ({
      path: it.path,
      snippet: (it.text_matches?.[0]?.fragment ?? '').trim().slice(0, SNIPPET_LIMIT),
    }));
    return { items, degraded: false };
  } catch {
    return { items: [], degraded: true };
  }
}

// ---------------------------------------------------------------------------
// Orchestration.
// ---------------------------------------------------------------------------

async function liveBuild(
  owner: string,
  repo: string,
  opts: BuildDossierOptions | undefined,
  now: Date,
): Promise<Dossier> {
  const client =
    opts?.client ?? new GitHubClient(opts?.fetch ? { fetch: opts.fetch } : {});

  opts?.onStage?.('meta');
  const meta = await fetchMeta(client, owner, repo);

  opts?.onStage?.('commits');
  const commits = await fetchCommits(
    client,
    owner,
    repo,
    meta.defaultBranch,
    meta.pushedAt,
  );

  opts?.onStage?.('branches');
  const branches = await fetchBranches(
    client,
    owner,
    repo,
    meta.defaultBranch,
    commits.finalCommit,
  );

  opts?.onStage?.('issues');
  const issues = await fetchIssues(client, owner, repo, now);

  opts?.onStage?.('readme');
  const readme = await fetchReadme(client, owner, repo);

  opts?.onStage?.('todos');
  const todos = await fetchTodos(client, owner, repo);

  const death = determineDeath(
    { pushedAt: meta.pushedAt, archived: meta.archived, monthly: commits.monthly },
    now,
  );

  const dossier: Dossier = {
    version: 'v1',
    repo: meta,
    commits,
    branches,
    issues,
    readme,
    todos,
    death,
    fetchedAt: now.toISOString(),
  };

  // The whole contract is validated before anything downstream (or the cache)
  // can trust it (SPEC §3).
  return DossierSchema.parse(dossier);
}

export async function buildDossier(
  owner: string,
  repo: string,
  opts?: BuildDossierOptions,
): Promise<Dossier> {
  const cache = opts?.cache ?? getCache();
  const key = dossierKey(owner.toLowerCase(), repo.toLowerCase());
  const now = opts?.now?.() ?? new Date();

  if (!opts?.bypassCache) {
    const cached = await cache.get<unknown>(key);
    if (cached) {
      const parsed = DossierSchema.safeParse(cached);
      if (parsed.success) return parsed.data;
    }

    const seed = await getPrecached(owner, repo);
    if (seed) {
      await cache.set(key, seed.dossier, TTL_24H);
      return seed.dossier;
    }
  }

  const dossier = await liveBuild(owner, repo, opts, now);
  await cache.set(key, dossier, TTL_24H);
  return dossier;
}
