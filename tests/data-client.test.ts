/**
 * GitHubClient — retry/back-off, the §9 rate-limit dance, and the
 * "private == missing" 404/403 collapse. The fetch, clock, and sleep are all
 * injected, so nothing here touches the network or waits in real time.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { GitHubClient, lastPageFromLink, type FetchLike } from "../lib/github/client";
import {
  GitHubError,
  GitHubRateLimitError,
  RepoNotFoundError,
} from "../lib/github/errors";

const FIXED_NOW_MS = 1_700_000_000_000;

function json(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

/** A fetch that returns each queued response in order (last one repeats). */
function sequence(responses: Array<() => Response | Promise<Response>>): {
  fetch: FetchLike;
  calls: () => number;
} {
  let i = 0;
  let calls = 0;
  const fetch: FetchLike = () => {
    calls += 1;
    const make = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return Promise.resolve(make());
  };
  return { fetch, calls: () => calls };
}

describe("GitHubClient — mandated headers", () => {
  it("sends auth, api-version, accept, and the ToS User-Agent", async () => {
    let captured: RequestInit | undefined;
    const fetch: FetchLike = (_url, init) => {
      captured = init;
      return Promise.resolve(json({ ok: true }));
    };
    const client = new GitHubClient({ token: "test-token", fetch });
    await client.getJson("/anything");

    const h = new Headers(captured?.headers);
    expect(h.get("authorization")).toBe("Bearer test-token");
    expect(h.get("accept")).toBe("application/vnd.github+json");
    expect(h.get("x-github-api-version")).toBe("2022-11-28");
    expect(h.get("user-agent")).toBe(
      "repo-seance (autonomous-build; +https://github.com/AlexanderLos/repo-seance)",
    );
  });

  it("lets a per-call Accept override the default without dropping the rest", async () => {
    let captured: RequestInit | undefined;
    const fetch: FetchLike = (_url, init) => {
      captured = init;
      return Promise.resolve(new Response("raw", { status: 200 }));
    };
    const client = new GitHubClient({ token: "t", fetch });
    await client.request("/repos/o/r/readme", {
      headers: { Accept: "application/vnd.github.raw" },
    });

    const h = new Headers(captured?.headers);
    expect(h.get("accept")).toBe("application/vnd.github.raw");
    expect(h.get("authorization")).toBe("Bearer t");
  });
});

describe("GitHubClient — 404/403 collapse (§9)", () => {
  it("maps a 404 to RepoNotFoundError carrying the slug", async () => {
    const { fetch } = sequence([() => json({}, { status: 404 })]);
    const client = new GitHubClient({ token: "t", fetch });
    await expect(client.getJson("/repos/ghost/town")).rejects.toBeInstanceOf(
      RepoNotFoundError,
    );
    await expect(client.getJson("/repos/ghost/town")).rejects.toThrow(/ghost\/town/);
  });

  it("maps a non-rate-limit 403 to RepoNotFoundError (private == missing)", async () => {
    const { fetch } = sequence([() => json({}, { status: 403 })]);
    const client = new GitHubClient({ token: "t", fetch });
    await expect(client.getJson("/repos/secret/repo")).rejects.toBeInstanceOf(
      RepoNotFoundError,
    );
  });
});

describe("GitHubClient — rate limiting (§9)", () => {
  it("honors a reset ≤5s away once, then succeeds", async () => {
    const resetEpoch = Math.floor(FIXED_NOW_MS / 1000) + 3; // 3s out
    const { fetch, calls } = sequence([
      () =>
        json(
          {},
          {
            status: 403,
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": String(resetEpoch),
            },
          },
        ),
      () => json({ ok: true }),
    ]);
    const sleep = vi.fn(() => Promise.resolve());
    const client = new GitHubClient({
      token: "t",
      fetch,
      sleep,
      now: () => FIXED_NOW_MS,
    });

    const data = await client.getJson<{ ok: boolean }>("/x");
    expect(data.ok).toBe(true);
    expect(calls()).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("honors a retry-after header on a 429", async () => {
    const { fetch, calls } = sequence([
      () => json({}, { status: 429, headers: { "retry-after": "2" } }),
      () => json({ ok: true }),
    ]);
    const sleep = vi.fn(() => Promise.resolve());
    const client = new GitHubClient({ token: "t", fetch, sleep });
    await client.getJson("/x");
    expect(calls()).toBe(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("throws GitHubRateLimitError without waiting when the reset is >5s away", async () => {
    const resetEpoch = Math.floor(FIXED_NOW_MS / 1000) + 100; // 100s out
    const { fetch, calls } = sequence([
      () =>
        json(
          {},
          {
            status: 403,
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": String(resetEpoch),
            },
          },
        ),
    ]);
    const sleep = vi.fn(() => Promise.resolve());
    const client = new GitHubClient({
      token: "t",
      fetch,
      sleep,
      now: () => FIXED_NOW_MS,
    });

    let thrown: unknown;
    try {
      await client.request("/x");
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(GitHubRateLimitError);
    expect((thrown as GitHubRateLimitError).resetAt).toBeInstanceOf(Date);
    expect(sleep).not.toHaveBeenCalled();
    expect(calls()).toBe(1);
  });

  it("does not loop: a second rate-limit after honoring once throws", async () => {
    const headers = { "x-ratelimit-remaining": "0", "retry-after": "1" };
    const { fetch, calls } = sequence([
      () => json({}, { status: 403, headers }),
      () => json({}, { status: 403, headers }),
    ]);
    const sleep = vi.fn(() => Promise.resolve());
    const client = new GitHubClient({ token: "t", fetch, sleep });
    await expect(client.request("/x")).rejects.toBeInstanceOf(GitHubRateLimitError);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(calls()).toBe(2);
  });
});

describe("GitHubClient — transient retries", () => {
  it("retries a network fault with back-off, then resolves", async () => {
    let n = 0;
    const fetch: FetchLike = () => {
      n += 1;
      return n <= 2 ? Promise.reject(new Error("ECONNRESET")) : Promise.resolve(json({ ok: true }));
    };
    const sleep = vi.fn(() => Promise.resolve());
    const client = new GitHubClient({ token: "t", fetch, sleep, random: () => 0 });
    await client.getJson("/x");
    expect(n).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxRetries network faults with a GitHubError", async () => {
    const fetch: FetchLike = () => Promise.reject(new Error("down"));
    const sleep = vi.fn(() => Promise.resolve());
    const client = new GitHubClient({ token: "t", fetch, sleep, maxRetries: 3 });
    await expect(client.getJson("/x")).rejects.toBeInstanceOf(GitHubError);
    expect(sleep).toHaveBeenCalledTimes(3); // 1 initial + 3 retries = 4 attempts
  });

  it("retries a 5xx then resolves", async () => {
    const { fetch, calls } = sequence([
      () => json({}, { status: 500 }),
      () => json({}, { status: 502 }),
      () => json({ ok: true }),
    ]);
    const sleep = vi.fn(() => Promise.resolve());
    const client = new GitHubClient({ token: "t", fetch, sleep });
    await client.getJson("/x");
    expect(calls()).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("surfaces a persistent 5xx as a GitHubError with the status", async () => {
    const { fetch } = sequence([() => json({}, { status: 503 })]);
    const sleep = vi.fn(() => Promise.resolve());
    const client = new GitHubClient({ token: "t", fetch, sleep });
    let thrown: unknown;
    try {
      await client.getJson("/x");
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(GitHubError);
    expect((thrown as GitHubError).status).toBe(503);
  });
});

describe("lastPageFromLink", () => {
  it("extracts the rel=last page number (the per_page=1 total trick)", () => {
    const link =
      '<https://api.github.com/r/c?per_page=1&page=2>; rel="next", ' +
      '<https://api.github.com/r/c?per_page=1&page=1234>; rel="last"';
    expect(lastPageFromLink(link)).toBe(1234);
  });

  it("returns null when there is no last link (single page)", () => {
    expect(lastPageFromLink('<https://x?page=2>; rel="next"')).toBeNull();
    expect(lastPageFromLink(null)).toBeNull();
    expect(lastPageFromLink(undefined)).toBeNull();
  });
});

describe("GitHubClient — lazy token", () => {
  it("does not read env at construction", () => {
    const saved = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    // Construction must not throw even with no token in the environment.
    expect(() => new GitHubClient({ fetch: () => Promise.resolve(json({})) })).not.toThrow();
    if (saved !== undefined) process.env.GITHUB_TOKEN = saved;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
