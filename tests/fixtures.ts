/**
 * Shared test fixtures. A single realistic, contract-valid Dossier that the
 * evidence and schema suites build on. `makeDossier` shallow-merges overrides so
 * a test can flip one section (e.g. a null README) without restating the rest.
 */
import type { Dossier } from "../lib/dossier/types";

/** First recent commit sha (the primary citable commit). */
export const RECENT_SHA_1 = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
/** Second recent commit sha. */
export const RECENT_SHA_2 = "b2c3d4e5f60718293a4b5c6d7e8f901234567890";
/** The final commit sha (also citable). */
export const FINAL_SHA = "f00dcafedeadbeef0011223344556677889900aa";

export function makeDossier(overrides: Partial<Dossier> = {}): Dossier {
  const base: Dossier = {
    version: "v1",
    repo: {
      owner: "atom",
      name: "atom",
      fullName: "atom/atom",
      description: "The hackable text editor for the 21st century",
      htmlUrl: "https://github.com/atom/atom",
      createdAt: "2011-08-15T18:00:00Z",
      pushedAt: "2022-12-15T12:00:00Z",
      archived: true,
      stars: 60123,
      forks: 17456,
      defaultBranch: "master",
      license: "MIT",
    },
    commits: {
      totalCount: 39872,
      fetchedCount: 2,
      capped: true,
      monthly: [
        { month: "2022-10", count: 5 },
        { month: "2022-11", count: 2 },
        { month: "2022-12", count: 1 },
      ],
      recent: [
        {
          sha: RECENT_SHA_1,
          message: "Merge pull request #21234 from atom/fix-startup",
          date: "2022-12-15T12:00:00Z",
          authorName: "Octo Cat",
          authorLogin: "octocat",
        },
        {
          sha: RECENT_SHA_2,
          message: "Fix the flaky startup spec",
          date: "2022-12-10T09:30:00Z",
          authorName: "Jane Dev",
          authorLogin: null,
        },
      ],
      finalCommit: {
        sha: FINAL_SHA,
        message: "Sunset Atom",
        date: "2022-12-15T12:00:00Z",
        authorName: "Octo Cat",
        authorLogin: "octocat",
      },
    },
    branches: {
      items: [
        {
          name: "master",
          lastCommitDate: "2022-12-15T12:00:00Z",
          aheadBy: 0,
          behindBy: 0,
        },
        {
          name: "feature/electron-upgrade",
          lastCommitDate: "2021-06-01T00:00:00Z",
          aheadBy: 3,
          behindBy: 812,
        },
      ],
      capped: false,
    },
    issues: {
      items: [
        {
          number: 21234,
          title: "Crash on startup after update",
          state: "open",
          createdAt: "2021-01-01T00:00:00Z",
          closedAt: null,
          comments: 12,
          labels: ["bug", "startup"],
        },
        {
          number: 100,
          title: "Add a proper dark mode",
          state: "closed",
          createdAt: "2019-05-01T00:00:00Z",
          closedAt: "2019-06-01T00:00:00Z",
          comments: 3,
          labels: [],
        },
      ],
      stats: {
        openCount: 1,
        totalFetched: 2,
        medianDaysToFirstResponse: 2.5,
        openOverOneYearNoReply: 1,
      },
      capped: false,
    },
    readme: {
      excerpt: "# Atom\n\nAtom is a hackable text editor for the 21st century.",
      truncated: true,
    },
    todos: {
      items: [
        { path: "src/main.js", snippet: "// TODO: remove this hack before shipping" },
        { path: "lib/parser/index.ts", snippet: "// FIXME: handle unicode paths" },
      ],
      degraded: false,
    },
    death: {
      status: "dead",
      daysSincePush: 570,
      flatlineMonth: "2022-12",
      reason: "Repository was archived by its owner.",
    },
    fetchedAt: "2024-07-08T00:00:00Z",
  };

  return { ...base, ...overrides };
}
