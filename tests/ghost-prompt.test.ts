import { describe, it, expect } from "vitest";
import {
  buildGhostSystemPrompt,
  GHOST_PROMPT_CHAR_BUDGET,
} from "../lib/ghost/prompt";
import { CANONICAL_REFUSAL } from "../lib/ghost/refusal";
import type { Dossier, IssueInfo } from "../lib/dossier/types";
import { makeDossier, RECENT_SHA_1, FINAL_SHA } from "./fixtures";

describe("buildGhostSystemPrompt — citable inventories", () => {
  const prompt = buildGhostSystemPrompt(makeDossier());

  it("names the repository and speaks in first person", () => {
    expect(prompt).toContain("atom/atom");
    expect(prompt.toLowerCase()).toContain("you are the ghost");
  });

  it("lists recent and final commit shas", () => {
    expect(prompt).toContain(RECENT_SHA_1);
    expect(prompt).toContain(FINAL_SHA);
  });

  it("lists issue numbers, branch names, and todo paths", () => {
    expect(prompt).toContain("#21234");
    expect(prompt).toContain("feature/electron-upgrade");
    expect(prompt).toContain("src/main.js");
  });

  it("includes the README excerpt as quoted material", () => {
    expect(prompt).toContain("# Atom");
    expect(prompt).toContain("README EXCERPT");
  });

  it("states the vitals numbers exactly", () => {
    expect(prompt).toContain("60123"); // stars
    expect(prompt).toContain("570"); // days silent
  });
});

describe("buildGhostSystemPrompt — the rules", () => {
  const prompt = buildGhostSystemPrompt(makeDossier());

  it("carries the canonical refusal verbatim (single source)", () => {
    expect(prompt).toContain(CANONICAL_REFUSAL);
  });

  it("mandates the machine-readable EVIDENCE block", () => {
    expect(prompt).toContain("EVIDENCE:");
  });

  it("mandates numerals for every stated count (machine-verifiable record)", () => {
    expect(prompt).toContain("NUMERALS");
    expect(prompt).toContain("machine-verifiable record");
    expect(prompt.toLowerCase()).toContain("never spell");
  });

  it("states §9 injection resistance firmly", () => {
    expect(prompt).toContain("QUOTED MATERIAL");
    expect(prompt.toLowerCase()).toContain("untrusted");
    expect(prompt).toContain("INJECTION RESISTANCE");
    expect(prompt.toLowerCase()).toContain("never");
  });

  it("stays within the character budget", () => {
    expect(prompt.length).toBeLessThanOrEqual(GHOST_PROMPT_CHAR_BUDGET);
  });
});

describe("buildGhostSystemPrompt — budget is enforced under pressure", () => {
  it("trims an oversized dossier yet keeps persona + rules intact", () => {
    const bloatedIssues: IssueInfo[] = Array.from({ length: 200 }, (_, i) => ({
      number: i + 1,
      title: "a very long issue title ".repeat(20),
      state: "open" as const,
      createdAt: "2020-01-01T00:00:00Z",
      closedAt: null,
      comments: 0,
      labels: ["bug", "help wanted"],
    }));
    const bloated: Dossier = makeDossier({
      readme: { excerpt: "x".repeat(200_000), truncated: true },
      issues: {
        items: bloatedIssues,
        stats: {
          openCount: 200,
          totalFetched: 200,
          medianDaysToFirstResponse: null,
          openOverOneYearNoReply: 200,
        },
        capped: true,
      },
    });

    const prompt = buildGhostSystemPrompt(bloated);
    expect(prompt.length).toBeLessThanOrEqual(GHOST_PROMPT_CHAR_BUDGET);
    // The fixed tail must survive the trim — the rules are never cut away.
    expect(prompt).toContain(CANONICAL_REFUSAL);
    expect(prompt).toContain("INJECTION RESISTANCE");
    expect(prompt.toLowerCase()).toContain("you are the ghost");
  });

  it("omits the README section cleanly when there is no README", () => {
    const prompt = buildGhostSystemPrompt(
      makeDossier({ readme: { excerpt: null, truncated: false } }),
    );
    expect(prompt).not.toContain("README EXCERPT");
    expect(prompt).toContain(CANONICAL_REFUSAL);
  });
});
