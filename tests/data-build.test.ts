/**
 * buildDossier — the full live assembly plus its short-circuits. A tiny in-memory
 * GitHub router stands in for `fetch`, so pagination, the Link-total trick, UTC
 * month bucketing, PR filtering, median first-response, and search degradation
 * are all exercised without a single network call.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildDossier,
  monthKeyUtc,
  firstLine,
  type DossierStage,
} from "../lib/dossier/build";
import { DossierSchema, type Dossier } from "../lib/dossier/types";
import { LruStore } from "../lib/cache";
import { dossierKey } from "../lib/cache/keys";
import { GitHubClient, type FetchLike } from "../lib/github/client";
import { precachedFileName } from "../lib/graveyard/precached";
import { makeDossier } from "./fixtures";

const NOW = new Date("2024-07-08T00:00:00.000Z");
const noopSleep = () => Promise.resolve();

interface Route {
  match: (u: URL) => boolean;
  res: (u: URL) => Response;
}

function json(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

function router(routes: Route[]): { fetch: FetchLike; calls: URL[] } {
  const calls: URL[] = [];
  const fetch: FetchLike = (url) => {
    const u = new URL(url);
    calls.push(u);
    for (const r of routes) {
      if (r.match(u)) return Promise.resolve(r.res(u));
    }
    return Promise.resolve(json({ message: "Not Found" }, { status: 404 }));
  };
  return { fetch, calls };
}

/** A client wired to the given routes, with a no-op sleep. */
function clientFor(routes: Route[]): { client: GitHubClient; calls: URL[] } {
  const { fetch, calls } = router(routes);
  return {
    client: new GitHubClient({ token: "test-token", fetch, sleep: noopSleep }),
    calls,
  };
}

const REPO_META = {
  name: "deadrepo",
  full_name: "deadorg/deadrepo",
  owner: { login: "deadorg" },
  description: "A repo that died",
  html_url: "https://github.com/deadorg/deadrepo",
  created_at: "2015-01-01T00:00:00Z",
  pushed_at: "2022-12-31T23:30:00Z",
  archived: true,
  stargazers_count: 4321,
  forks_count: 210,
  default_branch: "main",
  license: { spdx_id: "MIT", name: "MIT License" },
  open_issues_count: 5,
};

const P = "/repos/deadorg/deadrepo";

function happyRoutes(): Route[] {
  return [
    { match: (u) => u.pathname === P, res: () => json(REPO_META) },
    // Commits total probe (per_page=1) → Link rel=last says 1234.
    {
      match: (u) =>
        u.pathname === `${P}/commits` && u.searchParams.get("per_page") === "1",
      res: () =>
        json([{ sha: "aaaaaaa", commit: { message: "x" }, author: null }], {
          headers: {
            Link:
              `<https://api.github.com${P}/commits?sha=main&per_page=1&page=1234>; rel="last", ` +
              `<https://api.github.com${P}/commits?sha=main&per_page=1&page=2>; rel="next"`,
          },
        }),
    },
    // Commits page (per_page=100): three commits, newest first, crossing a UTC
    // month boundary. The second has a >200-char single-line message.
    {
      match: (u) =>
        u.pathname === `${P}/commits` && u.searchParams.get("per_page") === "100",
      res: () =>
        json([
          {
            sha: "aaaaaaa1111111111111111111111111111111",
            commit: {
              message: "Final commit\n\nA long body preserved only in finalCommit.",
              committer: { name: "Alice", date: "2023-01-01T04:30:00Z" },
              author: { name: "Alice", date: "2023-01-01T04:30:00Z" },
            },
            author: { login: "alice" },
          },
          {
            sha: "bbbbbbb2222222222222222222222222222222",
            commit: {
              message: "A very long single line commit message ".repeat(10),
              committer: { name: "Bob", date: "2022-12-31T19:30:00Z" },
            },
            author: null,
          },
          {
            sha: "ccccccc3333333333333333333333333333333",
            commit: {
              message: "Small fix",
              committer: { name: "Cy", date: "2022-12-15T12:00:00Z" },
            },
            author: { login: "cy" },
          },
        ]),
    },
    // Branches: the default (main) plus one feature branch.
    {
      match: (u) => u.pathname === `${P}/branches`,
      res: () =>
        json([
          { name: "main", commit: { sha: "aaaaaaa1111111111111111111111111111111", url: "" } },
          { name: "dev", commit: { sha: "devsha1234567890", url: "" } },
        ]),
    },
    // Individual commit lookup for the feature branch's last-commit date.
    {
      match: (u) => u.pathname.startsWith(`${P}/commits/`),
      res: () =>
        json({
          sha: "devsha1234567890",
          commit: { committer: { name: "Dee", date: "2021-06-01T00:00:00Z" } },
          author: null,
        }),
    },
    // Compare for ahead/behind.
    {
      match: (u) => u.pathname.startsWith(`${P}/compare/`),
      res: () => json({ ahead_by: 3, behind_by: 250 }),
    },
    // Issue comments (median first response).
    {
      match: (u) => /\/issues\/\d+\/comments$/.test(u.pathname),
      res: () => json([{ created_at: "2020-01-06T00:00:00Z" }]),
    },
    // Issues list: one PR (filtered) + two real issues.
    {
      match: (u) => u.pathname === `${P}/issues`,
      res: () =>
        json([
          {
            number: 501,
            title: "A pull request",
            state: "open",
            created_at: "2024-06-01T00:00:00Z",
            closed_at: null,
            comments: 2,
            labels: [],
            pull_request: { url: "https://api.github.com/pulls/501" },
          },
          {
            number: 42,
            title: "Crash on start",
            state: "open",
            created_at: "2020-01-01T00:00:00Z",
            closed_at: null,
            comments: 3,
            labels: [{ name: "bug" }, "startup"],
          },
          {
            number: 7,
            title: "Old silent bug",
            state: "open",
            created_at: "2019-01-01T00:00:00Z",
            closed_at: null,
            comments: 0,
            labels: [],
          },
        ]),
    },
    // README (raw).
    {
      match: (u) => u.pathname === `${P}/readme`,
      res: () => new Response("# Deadrepo\n\nOnce it lived.", { status: 200 }),
    },
    // Code search for TODO/FIXME.
    {
      match: (u) => u.pathname === "/search/code",
      res: () =>
        json({
          total_count: 2,
          items: [
            { path: "src/index.js", text_matches: [{ fragment: "// TODO: rewrite everything" }] },
            { path: "lib/old.ts", text_matches: [{ fragment: "// FIXME: broken" }] },
          ],
        }),
    },
  ];
}

describe("buildDossier — full live build", () => {
  it("assembles a schema-valid Dossier from the GitHub surface", async () => {
    const { client } = clientFor(happyRoutes());
    const stages: DossierStage[] = [];
    const dossier = await buildDossier("deadorg", "deadrepo", {
      client,
      bypassCache: true,
      cache: new LruStore(),
      now: () => NOW,
      onStage: (s) => stages.push(s),
    });

    // Stages fire once each, in the mandated order.
    expect(stages).toEqual([
      "meta",
      "commits",
      "branches",
      "issues",
      "readme",
      "todos",
    ]);

    // The whole object round-trips the contract schema.
    expect(DossierSchema.safeParse(dossier).success).toBe(true);

    // Meta.
    expect(dossier.repo.stars).toBe(4321);
    expect(dossier.repo.license).toBe("MIT");
    expect(dossier.repo.defaultBranch).toBe("main");

    // Commits: total via the Link trick, capped because 1234 > 3 fetched.
    expect(dossier.commits.totalCount).toBe(1234);
    expect(dossier.commits.fetchedCount).toBe(3);
    expect(dossier.commits.capped).toBe(true);

    // UTC month buckets, ascending. The Jan commit is 04:30Z (still January).
    expect(dossier.commits.monthly).toEqual([
      { month: "2022-12", count: 2 },
      { month: "2023-01", count: 1 },
    ]);

    // recent uses first-line-only messages; the long one is capped at 200.
    expect(dossier.commits.recent).toHaveLength(3);
    expect(dossier.commits.recent[0].message).toBe("Final commit");
    expect(dossier.commits.recent[1].message.length).toBe(200);
    expect(dossier.commits.recent[1].message).not.toContain("\n");

    // finalCommit keeps the FULL message (body included).
    expect(dossier.commits.finalCommit?.message).toContain(
      "preserved only in finalCommit",
    );
    expect(dossier.commits.finalCommit?.authorLogin).toBe("alice");

    // Branches: default branch reuses finalCommit; feature branch is looked up.
    const main = dossier.branches.items.find((b) => b.name === "main");
    const dev = dossier.branches.items.find((b) => b.name === "dev");
    expect(main).toMatchObject({
      lastCommitDate: "2023-01-01T04:30:00Z",
      aheadBy: 0,
      behindBy: 0,
    });
    expect(dev).toMatchObject({
      lastCommitDate: "2021-06-01T00:00:00Z",
      aheadBy: 3,
      behindBy: 250,
    });

    // Issues: the PR (#501) is filtered out.
    expect(dossier.issues.items.map((i) => i.number)).toEqual([42, 7]);
    expect(dossier.issues.items[0].labels).toEqual(["bug", "startup"]);
    expect(dossier.issues.stats.openCount).toBe(2);
    expect(dossier.issues.stats.openOverOneYearNoReply).toBe(1); // #7 only
    // #42 got its first comment 5 days after opening.
    expect(dossier.issues.stats.medianDaysToFirstResponse).toBe(5);

    // README captured, not truncated.
    expect(dossier.readme.excerpt).toContain("# Deadrepo");
    expect(dossier.readme.truncated).toBe(false);

    // TODOs from search, honest and not degraded.
    expect(dossier.todos.degraded).toBe(false);
    expect(dossier.todos.items).toHaveLength(2);
    expect(dossier.todos.items[0]).toEqual({
      path: "src/index.js",
      snippet: "// TODO: rewrite everything",
    });

    // Deterministic death: archived → dead, flatline = last active month.
    expect(dossier.death.status).toBe("dead");
    expect(dossier.death.flatlineMonth).toBe("2023-01");
  });
});

describe("buildDossier — commit pagination cap", () => {
  it("stops at 10 pages of 100 and marks the section capped", async () => {
    const routes: Route[] = [
      { match: (u) => u.pathname === P, res: () => json(REPO_META) },
      // Probe with no Link → single-page total of 1 (trick unavailable).
      {
        match: (u) =>
          u.pathname === `${P}/commits` && u.searchParams.get("per_page") === "1",
        res: () => json([{ sha: "z", commit: { message: "z" }, author: null }]),
      },
      // Every page returns a full 100 → the loop hits the 10-page cap.
      {
        match: (u) =>
          u.pathname === `${P}/commits` && u.searchParams.get("per_page") === "100",
        res: () =>
          json(
            Array.from({ length: 100 }, (_v, i) => ({
              sha: `sha${i}`,
              commit: { message: "c", committer: { name: "n", date: "2020-05-10T00:00:00Z" } },
              author: null,
            })),
          ),
      },
      // Everything else degrades cleanly so the build still completes.
      { match: (u) => u.pathname === `${P}/branches`, res: () => json([]) },
      { match: (u) => u.pathname === `${P}/issues`, res: () => json([]) },
      { match: (u) => u.pathname === `${P}/readme`, res: () => json({}, { status: 404 }) },
      {
        match: (u) => u.pathname === "/search/code",
        res: () => json({ message: "rate limited" }, { status: 403 }),
      },
    ];
    const { client } = clientFor(routes);
    const dossier = await buildDossier("deadorg", "deadrepo", {
      client,
      bypassCache: true,
      cache: new LruStore(),
      now: () => NOW,
    });

    expect(dossier.commits.fetchedCount).toBe(1000);
    expect(dossier.commits.capped).toBe(true);
    expect(dossier.commits.recent).toHaveLength(30);
    expect(dossier.commits.monthly).toEqual([{ month: "2020-05", count: 1000 }]);
    // README 404 → honest null; search 403 → honest degraded empty.
    expect(dossier.readme.excerpt).toBeNull();
    expect(dossier.todos.degraded).toBe(true);
    expect(dossier.todos.items).toHaveLength(0);
  });
});

describe("buildDossier — search degradation is never faked", () => {
  function routesWithSearch(searchRes: () => Response): Route[] {
    return [
      { match: (u) => u.pathname === P, res: () => json(REPO_META) },
      {
        match: (u) =>
          u.pathname === `${P}/commits` && u.searchParams.get("per_page") === "1",
        res: () => json([]),
      },
      {
        match: (u) =>
          u.pathname === `${P}/commits` && u.searchParams.get("per_page") === "100",
        res: () => json([]),
      },
      { match: (u) => u.pathname === `${P}/branches`, res: () => json([]) },
      { match: (u) => u.pathname === `${P}/issues`, res: () => json([]) },
      { match: (u) => u.pathname === `${P}/readme`, res: () => json({}, { status: 404 }) },
      { match: (u) => u.pathname === "/search/code", res: searchRes },
    ];
  }

  it("degrades on a 422 validation failure", async () => {
    const { client } = clientFor(
      routesWithSearch(() => json({ message: "Validation Failed" }, { status: 422 })),
    );
    const dossier = await buildDossier("deadorg", "deadrepo", {
      client,
      bypassCache: true,
      cache: new LruStore(),
      now: () => NOW,
    });
    expect(dossier.todos).toEqual({ items: [], degraded: true });
  });

  it("degrades (does not throw) when search itself is rate-limited", async () => {
    const { client } = clientFor(
      routesWithSearch(() =>
        json({ message: "rate limited" }, {
          status: 403,
          headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "9999999999" },
        }),
      ),
    );
    const dossier = await buildDossier("deadorg", "deadrepo", {
      client,
      bypassCache: true,
      cache: new LruStore(),
      now: () => NOW,
    });
    expect(dossier.todos.degraded).toBe(true);
  });
});

describe("buildDossier — cache short-circuit", () => {
  it("returns the cached Dossier without any fetch", async () => {
    const cache = new LruStore();
    await cache.set(dossierKey("atom", "atom"), makeDossier(), 60);
    const throwFetch: FetchLike = () => {
      throw new Error("fetch must not run on a cache hit");
    };
    const dossier = await buildDossier("Atom", "Atom", { fetch: throwFetch, cache });
    expect(dossier.repo.fullName).toBe("atom/atom");
  });
});

describe("buildDossier — precache write-through", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "graveyard-"));
  });

  it("seeds from a committed snapshot and writes it through to the cache", async () => {
    process.env.GRAVEYARD_DIR = tmp;
    const dossier = makeDossier();
    const autopsy = {
      epitaph: "It rests now.",
      causes: [
        { label: "Abandonment", confidencePct: 80, evidence: [{ type: "commit", ref: "a1b2c3d" }] },
        { label: "Neglect", confidencePct: 60, evidence: [{ type: "readme", ref: "README" }] },
      ],
      revival: [
        { step: "Fork it", effort: "low" },
        { step: "Fix the build", effort: "medium" },
        { step: "Ship a release", effort: "high" },
      ],
      lastWordsGloss: "the todo was never fixed",
    };
    await fs.writeFile(
      path.join(tmp, precachedFileName("atom", "atom")),
      JSON.stringify({ dossier, autopsy }),
      "utf8",
    );

    const cache = new LruStore();
    const throwFetch: FetchLike = () => {
      throw new Error("must not do a live build when a snapshot exists");
    };
    const result = await buildDossier("atom", "atom", { fetch: throwFetch, cache });
    expect(result.repo.fullName).toBe("atom/atom");

    // Write-through: the snapshot now lives in the cache too.
    const cached = await cache.get<Dossier>(dossierKey("atom", "atom"));
    expect(cached?.repo.fullName).toBe("atom/atom");

    delete process.env.GRAVEYARD_DIR;
    await fs.rm(tmp, { recursive: true, force: true });
  });
});

describe("month + message helpers", () => {
  it("buckets by UTC month across offset boundaries", () => {
    // 23:30 -05:00 on Dec 31 is 04:30Z on Jan 1 → January.
    expect(monthKeyUtc("2022-12-31T23:30:00-05:00")).toBe("2023-01");
    // 00:30 +05:00 on Jan 1 is 19:30Z on Dec 31 → December.
    expect(monthKeyUtc("2023-01-01T00:30:00+05:00")).toBe("2022-12");
    expect(monthKeyUtc("2023-03-15T12:00:00Z")).toBe("2023-03");
  });

  it("firstLine keeps only the first line and caps its length", () => {
    expect(firstLine("subject\n\nbody")).toBe("subject");
    expect(firstLine("x".repeat(300))).toHaveLength(200);
    expect(firstLine("short")).toBe("short");
  });
});
