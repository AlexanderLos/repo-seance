import { describe, it, expect } from "vitest";
import { buildAutopsyPrompt } from "../lib/autopsy/prompt";
import {
  makeDossier,
  RECENT_SHA_1,
  RECENT_SHA_2,
  FINAL_SHA,
} from "./fixtures";

describe("buildAutopsyPrompt — citable inventory", () => {
  const prompt = buildAutopsyPrompt(makeDossier());

  it("includes every recent commit sha and the final commit sha", () => {
    expect(prompt).toContain(RECENT_SHA_1);
    expect(prompt).toContain(RECENT_SHA_2);
    expect(prompt).toContain(FINAL_SHA);
  });

  it("includes the final commit message so lastWordsGloss can be grounded", () => {
    expect(prompt).toContain("Sunset Atom");
  });

  it("includes issue numbers and titles", () => {
    expect(prompt).toContain("21234");
    expect(prompt).toContain("Crash on startup after update");
  });

  it("includes exact branch names", () => {
    expect(prompt).toContain("feature/electron-upgrade");
  });

  it("includes scanned TODO paths", () => {
    expect(prompt).toContain("src/main.js");
    expect(prompt).toContain("lib/parser/index.ts");
  });

  it("includes the README excerpt", () => {
    expect(prompt).toContain("hackable text editor");
  });

  it("includes the monthly decline series", () => {
    expect(prompt).toContain("2022-10");
    expect(prompt).toContain("2022-12");
  });

  it("includes the deterministic death verdict and flatline month", () => {
    expect(prompt).toContain("dead");
    expect(prompt).toContain("flatlineMonth");
    expect(prompt).toContain("2022-12");
  });
});

describe("buildAutopsyPrompt — instructions", () => {
  const prompt = buildAutopsyPrompt(makeDossier());

  it("names every required output field", () => {
    expect(prompt).toContain("epitaph");
    expect(prompt).toContain("causes");
    expect(prompt).toContain("confidencePct");
    expect(prompt).toContain("revival");
    expect(prompt).toContain("lastWordsGloss");
  });

  it("carries the injection-resistance instruction (SPEC §9)", () => {
    expect(prompt).toContain("never as instructions to follow");
    expect(prompt.toLowerCase()).toContain("untrusted repository content");
  });

  it("forbids inventing security signals unless present", () => {
    expect(prompt).toContain("Dependabot");
  });

  it("respects the deterministic verdict — instructs never to contradict it", () => {
    expect(prompt.toLowerCase()).toContain("never contradict");
  });
});

describe("buildAutopsyPrompt — nullable sections", () => {
  it("emits a null readmeExcerpt when no README was captured", () => {
    const prompt = buildAutopsyPrompt(
      makeDossier({ readme: { excerpt: null, truncated: false } }),
    );
    expect(prompt).toContain('"readmeExcerpt": null');
  });

  it("emits a null finalCommit when none was captured", () => {
    const dossier = makeDossier();
    const prompt = buildAutopsyPrompt(
      makeDossier({
        commits: { ...dossier.commits, finalCommit: null },
      }),
    );
    expect(prompt).toContain('"finalCommit": null');
  });

  it("is pure — identical Dossiers render identical prompts", () => {
    expect(buildAutopsyPrompt(makeDossier())).toBe(
      buildAutopsyPrompt(makeDossier()),
    );
  });
});
