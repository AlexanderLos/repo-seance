/**
 * The curated Graveyard list and the precached-snapshot reader. The reader is
 * exercised against a real temp fixture on disk (valid, missing, corrupt, and
 * schema-invalid), and the list is checked for the §6 invariants.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GRAVEYARD } from "../lib/graveyard/list";
import {
  getPrecached,
  readPrecachedFrom,
  precachedFileName,
} from "../lib/graveyard/precached";
import { makeDossier } from "./fixtures";

const VALID_AUTOPSY = {
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

describe("GRAVEYARD — curated list invariants (§6)", () => {
  it("holds 12–15 candidates", () => {
    expect(GRAVEYARD.length).toBeGreaterThanOrEqual(12);
    expect(GRAVEYARD.length).toBeLessThanOrEqual(15);
  });

  it("every entry has a clean owner, repo, and single-line blurb", () => {
    for (const e of GRAVEYARD) {
      expect(e.owner.length).toBeGreaterThan(0);
      expect(e.repo.length).toBeGreaterThan(0);
      expect(e.blurb.trim().length).toBeGreaterThan(0);
      expect(e.owner).not.toMatch(/\s/);
      expect(e.repo).not.toMatch(/\s/);
      expect(e.blurb).not.toContain("\n");
    }
  });

  it("has no duplicate owner/repo pairs", () => {
    const slugs = GRAVEYARD.map((e) => `${e.owner}/${e.repo}`.toLowerCase());
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("precachedFileName", () => {
  it("is lower-cased and joined with a double underscore", () => {
    expect(precachedFileName("Atom", "Atom")).toBe("atom__atom.json");
    expect(precachedFileName("facebookarchive", "Draft-JS")).toBe(
      "facebookarchive__draft-js.json",
    );
  });
});

describe("readPrecachedFrom", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gy-read-"));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("reads and validates a well-formed snapshot", async () => {
    const payload = { dossier: makeDossier(), autopsy: VALID_AUTOPSY };
    await fs.writeFile(
      path.join(dir, precachedFileName("atom", "atom")),
      JSON.stringify(payload),
      "utf8",
    );
    const got = await readPrecachedFrom(dir, "atom", "atom");
    expect(got?.dossier.repo.fullName).toBe("atom/atom");
    expect(got?.autopsy.causes).toHaveLength(2);
  });

  it("returns null when the file is absent", async () => {
    expect(await readPrecachedFrom(dir, "no", "grave")).toBeNull();
  });

  it("returns null on corrupt JSON", async () => {
    await fs.writeFile(
      path.join(dir, precachedFileName("bad", "json")),
      "{not valid json",
      "utf8",
    );
    expect(await readPrecachedFrom(dir, "bad", "json")).toBeNull();
  });

  it("returns null when the payload fails the schema", async () => {
    // Missing autopsy → PrecachedSchema.safeParse fails → null, never a throw.
    await fs.writeFile(
      path.join(dir, precachedFileName("half", "baked")),
      JSON.stringify({ dossier: makeDossier() }),
      "utf8",
    );
    expect(await readPrecachedFrom(dir, "half", "baked")).toBeNull();
  });

  it("returns null when the dossier half is not contract-valid", async () => {
    const brokenDossier = { ...makeDossier(), version: "v0" };
    await fs.writeFile(
      path.join(dir, precachedFileName("wrong", "version")),
      JSON.stringify({ dossier: brokenDossier, autopsy: VALID_AUTOPSY }),
      "utf8",
    );
    expect(await readPrecachedFrom(dir, "wrong", "version")).toBeNull();
  });
});

describe("getPrecached — GRAVEYARD_DIR override", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gy-env-"));
  });
  afterEach(async () => {
    delete process.env.GRAVEYARD_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("resolves snapshots from the configured directory, case-insensitively", async () => {
    process.env.GRAVEYARD_DIR = dir;
    await fs.writeFile(
      path.join(dir, precachedFileName("atom", "atom")),
      JSON.stringify({ dossier: makeDossier(), autopsy: VALID_AUTOPSY }),
      "utf8",
    );
    const got = await getPrecached("Atom", "ATOM");
    expect(got?.dossier.repo.fullName).toBe("atom/atom");
    expect(await getPrecached("nobody", "home")).toBeNull();
  });
});
