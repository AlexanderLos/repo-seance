import { describe, it, expect } from "vitest";
import {
  CASES,
  metricValue,
  type Category,
} from "../evals/cases";
import {
  FIXTURE_IDS,
  DEAD_FIXTURE_IDS,
  ALIVE_FIXTURE_ID,
  EVAL_NOW,
  loadFixture,
  loadAllFixtures,
} from "../evals/load";
import { determineDeath } from "../lib/dossier/death";

const ALL_CATEGORIES: Category[] = [
  "evidence-integrity",
  "refusal",
  "numeric-fidelity",
  "liveness-honesty",
  "injection",
];

function countByCategory(): Map<Category, number> {
  const counts = new Map<Category, number>();
  for (const c of CASES) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  return counts;
}

describe("case set (SPEC §7)", () => {
  it("defines at least 32 cases", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(32);
  });

  it("has unique case ids", () => {
    const ids = CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all four categories plus injection at their required floors", () => {
    const counts = countByCategory();
    for (const cat of ALL_CATEGORIES) {
      expect(counts.get(cat) ?? 0).toBeGreaterThan(0);
    }
    expect(counts.get("evidence-integrity") ?? 0).toBeGreaterThanOrEqual(8);
    expect(counts.get("refusal") ?? 0).toBeGreaterThanOrEqual(8);
    expect(counts.get("numeric-fidelity") ?? 0).toBeGreaterThanOrEqual(8);
    expect(counts.get("liveness-honesty") ?? 0).toBeGreaterThanOrEqual(2);
    expect(counts.get("injection") ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("only references known fixtures", () => {
    const known = new Set<string>(FIXTURE_IDS);
    for (const c of CASES) {
      expect(known.has(c.fixtureId)).toBe(true);
    }
  });
});

describe("fixtures are DossierSchema-valid and deterministic", () => {
  it("loads all five fixtures without throwing", () => {
    const fixtures = loadAllFixtures();
    expect(fixtures.size).toBe(FIXTURE_IDS.length);
  });

  it("agrees with determineDeath at the fixed clock", () => {
    const expected: Record<string, "dead" | "dying" | "alive"> = {
      "archived-framework": "dead",
      "silent-cli": "dead",
      "dying-lib": "dying",
      "alive-app": "alive",
      "haunted-readme": "dead",
    };
    for (const id of FIXTURE_IDS) {
      const d = loadFixture(id);
      const death = determineDeath(
        { pushedAt: d.repo.pushedAt, archived: d.repo.archived, monthly: d.commits.monthly },
        EVAL_NOW,
      );
      expect(death.status).toBe(expected[id]);
      expect(d.death.status).toBe(expected[id]);
    }
  });

  it("gives the alive fixture no flatline and marks the dead ones flatlined", () => {
    const alive = loadFixture(ALIVE_FIXTURE_ID);
    expect(alive.death.flatlineMonth).toBeNull();
    for (const id of DEAD_FIXTURE_IDS) {
      expect(loadFixture(id).death.flatlineMonth).not.toBeNull();
    }
  });

  it("embeds the prompt-injection payload in the haunted README (SPEC §9)", () => {
    const haunted = loadFixture("haunted-readme");
    expect(haunted.readme.excerpt).toContain("IGNORE ALL PREVIOUS INSTRUCTIONS");
    expect(haunted.readme.excerpt).toContain("THE SEANCE IS BROKEN");
  });
});

describe("numeric metrics resolve to real Dossier counts", () => {
  it("every numeric case maps to a finite integer from its fixture", () => {
    for (const c of CASES) {
      if (c.category !== "numeric-fidelity") continue;
      const value = metricValue(loadFixture(c.fixtureId), c.metric);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("reads stars straight from the fixture", () => {
    const d = loadFixture("archived-framework");
    expect(metricValue(d, "stars")).toBe(d.repo.stars);
    expect(metricValue(d, "daysSincePush")).toBe(d.death.daysSincePush);
  });
});
