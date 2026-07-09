import { describe, it, expect } from "vitest";
import { determineDeath, type DeathInput } from "../lib/dossier/death";
import type { MonthlyBucket } from "../lib/dossier/types";

const NOW = new Date("2024-06-15T12:00:00.000Z");
const DAY_MS = 86_400_000;

/** ISO string for a push exactly `n` days before NOW. */
function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * DAY_MS).toISOString();
}

function input(partial: Partial<DeathInput>): DeathInput {
  return { pushedAt: daysAgo(0), archived: false, monthly: [], ...partial };
}

describe("determineDeath — status boundaries", () => {
  it("364 days silent is still dying", () => {
    expect(determineDeath(input({ pushedAt: daysAgo(364) }), NOW).status).toBe(
      "dying",
    );
  });

  it("365 days silent is the inclusive upper edge of dying", () => {
    expect(determineDeath(input({ pushedAt: daysAgo(365) }), NOW).status).toBe(
      "dying",
    );
  });

  it("366 days silent tips over into dead", () => {
    expect(determineDeath(input({ pushedAt: daysAgo(366) }), NOW).status).toBe(
      "dead",
    );
  });

  it("180 days silent is the inclusive lower edge of dying", () => {
    expect(determineDeath(input({ pushedAt: daysAgo(180) }), NOW).status).toBe(
      "dying",
    );
  });

  it("179 days silent is still alive", () => {
    expect(determineDeath(input({ pushedAt: daysAgo(179) }), NOW).status).toBe(
      "alive",
    );
  });

  it("a fresh push is alive with zero days since push", () => {
    const death = determineDeath(input({ pushedAt: daysAgo(0) }), NOW);
    expect(death.status).toBe("alive");
    expect(death.daysSincePush).toBe(0);
  });
});

describe("determineDeath — archived overrides age", () => {
  it("archived but pushed 3 days ago is dead, cited as archived", () => {
    const death = determineDeath(
      input({
        pushedAt: daysAgo(3),
        archived: true,
        monthly: [{ month: "2024-05", count: 4 }],
      }),
      NOW,
    );
    expect(death.status).toBe("dead");
    expect(death.daysSincePush).toBe(3);
    expect(death.reason).toMatch(/archived/i);
  });
});

describe("determineDeath — daysSincePush arithmetic", () => {
  it("reports the exact day count", () => {
    expect(determineDeath(input({ pushedAt: daysAgo(200) }), NOW).daysSincePush).toBe(
      200,
    );
  });

  it("clamps a future push date to 0 (alive)", () => {
    const death = determineDeath(input({ pushedAt: daysAgo(-5) }), NOW);
    expect(death.daysSincePush).toBe(0);
    expect(death.status).toBe("alive");
  });
});

describe("determineDeath — flatline month", () => {
  const buckets: MonthlyBucket[] = [
    { month: "2023-01", count: 4 },
    { month: "2023-02", count: 2 },
    { month: "2023-03", count: 0 },
  ];

  it("picks the last month with >=1 commit, skipping trailing zero months", () => {
    const death = determineDeath(
      input({ pushedAt: daysAgo(500), monthly: buckets }),
      NOW,
    );
    expect(death.status).toBe("dead");
    expect(death.flatlineMonth).toBe("2023-02");
  });

  it("is order-independent (max active month wins)", () => {
    const shuffled: MonthlyBucket[] = [
      { month: "2023-03", count: 0 },
      { month: "2023-01", count: 4 },
      { month: "2023-02", count: 2 },
    ];
    expect(
      determineDeath(input({ pushedAt: daysAgo(500), monthly: shuffled }), NOW)
        .flatlineMonth,
    ).toBe("2023-02");
  });

  it("is null for a living repo — it has not flatlined", () => {
    expect(
      determineDeath(input({ pushedAt: daysAgo(10), monthly: buckets }), NOW)
        .flatlineMonth,
    ).toBeNull();
  });

  it("is null when there are no commit buckets", () => {
    expect(
      determineDeath(input({ pushedAt: daysAgo(500), monthly: [] }), NOW)
        .flatlineMonth,
    ).toBeNull();
  });
});
