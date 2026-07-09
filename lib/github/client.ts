/**
 * The single rate-limit-aware GitHub fetch wrapper (SPEC §3/§9). Everything in
 * the data layer goes through one `GitHubClient` so retries, back-off, the
 * User-Agent, and the ToS-mandated rate-limit behaviour live in exactly one
 * place.
 *
 * Behaviour:
 *  - Base `https://api.github.com`, authenticated with `GITHUB_TOKEN` (read
 *    lazily, at request time — never at import).
 *  - Retries 5xx responses and network faults with exponential back-off + jitter
 *    (up to `maxRetries`, default 3).
 *  - On a rate-limit response (429, or 403 with `x-ratelimit-remaining: 0` /
 *    `retry-after`) it honours `retry-after` / `x-ratelimit-reset` exactly once
 *    when the wait is ≤ 5s; otherwise it throws `GitHubRateLimitError` and does
 *    NOT probe further (§9: back off, do not hammer).
 *  - `getJson` collapses a non-rate-limit 404 **and** 403 into
 *    `RepoNotFoundError` — private and missing are indistinguishable (§9).
 *  - `fetch`, the clock, `sleep`, and the jitter source are all injectable so the
 *    unit tests never touch the network or the wall clock.
 */
import { GitHubError, GitHubRateLimitError, RepoNotFoundError } from './errors';
import { readEnv } from '../env';

/** The minimal fetch surface the client depends on; swapped out in tests. */
export type FetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

/** Construction options — every side-effecting dependency is injectable. */
export interface GitHubClientOptions {
  /** Bearer token; defaults to a lazy `readEnv('GITHUB_TOKEN')` at request time. */
  token?: string;
  /** Fetch implementation; defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** API base URL; defaults to `https://api.github.com`. */
  baseUrl?: string;
  /** Max retries for 5xx / network faults (not counting the first try). */
  maxRetries?: number;
  /** Sleep primitive; defaults to a real `setTimeout` promise. */
  sleep?: (ms: number) => Promise<void>;
  /** Jitter source in [0,1); defaults to `Math.random`. */
  random?: () => number;
  /** Clock in epoch-ms; defaults to `Date.now`. */
  now?: () => number;
}

const DEFAULT_BASE_URL = 'https://api.github.com';
const DEFAULT_MAX_RETRIES = 3;
/** Longest rate-limit wait we will sit through before giving up (§9). */
const MAX_RATE_LIMIT_WAIT_MS = 5_000;
/** Base unit for exponential back-off on transient failures. */
const BACKOFF_BASE_MS = 300;
/** Upper bound on the random jitter added to each back-off. */
const BACKOFF_JITTER_MS = 250;

const USER_AGENT =
  'repo-seance (autonomous-build; +https://github.com/AlexanderLos/repo-seance)';

/**
 * Parse the `page=N` of the `rel="last"` entry in a `Link` header. With
 * `per_page=1` this equals the total item count — the standard cheap-count
 * trick. Returns null when there is no `last` link (i.e. ≤ 1 page).
 */
export function lastPageFromLink(link: string | null | undefined): number | null {
  if (!link) return null;
  for (const part of link.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="last"/);
    if (match) {
      const page = match[1].match(/[?&]page=(\d+)/);
      if (page) return Number(page[1]);
    }
  }
  return null;
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GitHubClient {
  private readonly tokenValue: string | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(opts: GitHubClientOptions = {}) {
    this.tokenValue = opts.token;
    this.fetchImpl = opts.fetch ?? ((url, init) => fetch(url, init));
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.sleep = opts.sleep ?? realSleep;
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? Date.now;
  }

  /** Token, read lazily so construction (and `next build`) never needs env. */
  private token(): string {
    return this.tokenValue ?? readEnv('GITHUB_TOKEN');
  }

  /** Merge the mandated headers with any per-call overrides (e.g. raw Accept). */
  private headersFor(init?: RequestInit): Headers {
    const headers = new Headers({
      Authorization: `Bearer ${this.token()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
    });
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    return headers;
  }

  private isRateLimited(res: Response): boolean {
    if (res.status === 429) return true;
    if (res.status === 403) {
      if (res.headers.get('x-ratelimit-remaining') === '0') return true;
      if (res.headers.get('retry-after') !== null) return true;
    }
    return false;
  }

  /** Milliseconds to wait for a rate-limit reset; clamped to ≥ 0. */
  private rateLimitWaitMs(res: Response): number {
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter !== null) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
      const asDate = Date.parse(retryAfter);
      if (!Number.isNaN(asDate)) return Math.max(0, asDate - this.now());
      return 0;
    }
    const reset = res.headers.get('x-ratelimit-reset');
    if (reset !== null) {
      const resetMs = Number(reset) * 1000;
      if (Number.isFinite(resetMs)) return Math.max(0, resetMs - this.now());
    }
    return 0;
  }

  private rateLimitResetAt(res: Response): Date | null {
    const reset = res.headers.get('x-ratelimit-reset');
    if (reset !== null) {
      const seconds = Number(reset);
      if (Number.isFinite(seconds)) return new Date(seconds * 1000);
    }
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter !== null) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return new Date(this.now() + seconds * 1000);
    }
    return null;
  }

  private backoffMs(attempt: number): number {
    return BACKOFF_BASE_MS * 2 ** attempt + this.random() * BACKOFF_JITTER_MS;
  }

  /**
   * Low-level request. Handles retries and the rate-limit dance, then returns
   * the raw `Response` for the caller to interpret. Throws only
   * `GitHubRateLimitError` (sealed archive) or `GitHubError` (transient fault
   * that outlived every retry). Does NOT map 404/403 — that is `getJson`'s job,
   * so graceful callers (README, search) can inspect the status themselves.
   */
  async request(path: string, init?: RequestInit): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    let attempt = 0;
    let rateLimitHonored = false;

    for (;;) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          ...init,
          headers: this.headersFor(init),
        });
      } catch (err) {
        if (attempt < this.maxRetries) {
          await this.sleep(this.backoffMs(attempt));
          attempt += 1;
          continue;
        }
        const reason = err instanceof Error ? err.message : String(err);
        throw new GitHubError(
          `network error after ${attempt} retr${attempt === 1 ? 'y' : 'ies'}: ${reason}`,
        );
      }

      if (this.isRateLimited(res)) {
        const waitMs = this.rateLimitWaitMs(res);
        if (!rateLimitHonored && waitMs <= MAX_RATE_LIMIT_WAIT_MS) {
          rateLimitHonored = true;
          await this.sleep(waitMs);
          continue;
        }
        throw new GitHubRateLimitError(this.rateLimitResetAt(res));
      }

      if (res.status >= 500 && attempt < this.maxRetries) {
        await this.sleep(this.backoffMs(attempt));
        attempt += 1;
        continue;
      }

      return res;
    }
  }

  private slugFor(path: string): string {
    const match = path.match(/\/repos\/([^/?#]+\/[^/?#]+)/);
    return match ? match[1] : path;
  }

  /**
   * Request + parse JSON. A non-rate-limit 404 or 403 collapses to
   * `RepoNotFoundError` (§9: do not distinguish private from missing). Any other
   * non-2xx becomes a `GitHubError`.
   */
  async getJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.request(path, init);
    if (res.status === 404 || res.status === 403) {
      throw new RepoNotFoundError(this.slugFor(path));
    }
    if (!res.ok) {
      throw new GitHubError(
        `GitHub request failed: ${res.status} ${path}`,
        res.status,
      );
    }
    const raw: unknown = await res.json();
    return raw as T;
  }
}
