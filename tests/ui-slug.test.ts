import { describe, it, expect } from "vitest";
import { parseRepoInput, repoPath } from "../components/util/slug";

describe("parseRepoInput", () => {
  it("parses a bare owner/repo", () => {
    expect(parseRepoInput("atom/atom")).toEqual({ owner: "atom", repo: "atom" });
  });

  it("parses a full https GitHub URL", () => {
    expect(parseRepoInput("https://github.com/facebook/react")).toEqual({
      owner: "facebook",
      repo: "react",
    });
  });

  it("keeps dotted repo names and strips a .git clone suffix", () => {
    expect(parseRepoInput("github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
    expect(parseRepoInput("https://github.com/facebook/react.git")).toEqual({
      owner: "facebook",
      repo: "react",
    });
  });

  it("takes the first two segments of a deep URL", () => {
    expect(parseRepoInput("http://github.com/owner/repo/tree/main")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("handles scp-style git@ remotes and www hosts", () => {
    expect(parseRepoInput("git@github.com:owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
    expect(parseRepoInput("www.github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("trims whitespace, trailing slashes, and query/hash noise", () => {
    expect(parseRepoInput("  owner/repo/  ")).toEqual({
      owner: "owner",
      repo: "repo",
    });
    expect(parseRepoInput("github.com/owner/repo?tab=readme#top")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("preserves case (cache lowercasing happens elsewhere)", () => {
    expect(parseRepoInput("Atom/Atom")).toEqual({ owner: "Atom", repo: "Atom" });
  });

  it("rejects non-GitHub hosts and malformed input", () => {
    expect(parseRepoInput("https://gitlab.com/owner/repo")).toBeNull();
    expect(parseRepoInput("")).toBeNull();
    expect(parseRepoInput("   ")).toBeNull();
    expect(parseRepoInput("justoneword")).toBeNull();
    expect(parseRepoInput("owner/")).toBeNull();
    expect(parseRepoInput("/repo")).toBeNull();
    expect(parseRepoInput("-bad/repo")).toBeNull();
    expect(parseRepoInput("owner/re po")).toBeNull();
  });
});

describe("repoPath", () => {
  it("builds an encoded in-app path", () => {
    expect(repoPath({ owner: "atom", repo: "atom" })).toBe("/atom/atom");
    expect(repoPath({ owner: "vercel", repo: "next.js" })).toBe("/vercel/next.js");
  });
});
