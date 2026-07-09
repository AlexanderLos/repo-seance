import { describe, it, expect } from "vitest";
import {
  DossierSchema,
  RepoMetaSchema,
  MonthlyBucketSchema,
  CommitsSectionSchema,
  DeathSchema,
  type CommitInfo,
} from "../lib/dossier/types";
import {
  AutopsySchema,
  EvidenceRefSchema,
  type Autopsy,
} from "../lib/autopsy/schema";
import { CANONICAL_REFUSAL } from "../lib/ghost/refusal";
import { makeDossier } from "./fixtures";

describe("DossierSchema", () => {
  it("accepts the realistic shared fixture", () => {
    const parsed = DossierSchema.parse(makeDossier());
    expect(parsed.version).toBe("v1");
    expect(parsed.repo.fullName).toBe("atom/atom");
  });

  it("rejects a wrong version literal", () => {
    const bad = { ...makeDossier(), version: "v2" };
    expect(DossierSchema.safeParse(bad).success).toBe(false);
  });
});

describe("RepoMetaSchema", () => {
  const valid = makeDossier().repo;

  it("rejects a non-URL htmlUrl", () => {
    expect(RepoMetaSchema.safeParse({ ...valid, htmlUrl: "not a url" }).success).toBe(
      false,
    );
  });

  it("rejects negative stars", () => {
    expect(RepoMetaSchema.safeParse({ ...valid, stars: -1 }).success).toBe(false);
  });

  it("allows a null description and license", () => {
    expect(
      RepoMetaSchema.safeParse({ ...valid, description: null, license: null }).success,
    ).toBe(true);
  });
});

describe("MonthlyBucketSchema", () => {
  it("accepts a YYYY-MM month", () => {
    expect(MonthlyBucketSchema.safeParse({ month: "2024-01", count: 3 }).success).toBe(
      true,
    );
  });

  it("rejects a non-padded month", () => {
    expect(MonthlyBucketSchema.safeParse({ month: "2024-1", count: 3 }).success).toBe(
      false,
    );
  });
});

describe("CommitsSectionSchema", () => {
  const commit: CommitInfo = {
    sha: "0".repeat(40),
    message: "x",
    date: "2024-01-01T00:00:00Z",
    authorName: "a",
    authorLogin: null,
  };

  it("caps the citable recent set at 30", () => {
    const section = {
      totalCount: 40,
      fetchedCount: 40,
      capped: false,
      monthly: [],
      recent: Array.from({ length: 31 }, () => commit),
      finalCommit: null,
    };
    expect(CommitsSectionSchema.safeParse(section).success).toBe(false);
  });

  it("accepts exactly 30 recent commits", () => {
    const section = {
      totalCount: 40,
      fetchedCount: 40,
      capped: false,
      monthly: [],
      recent: Array.from({ length: 30 }, () => commit),
      finalCommit: null,
    };
    expect(CommitsSectionSchema.safeParse(section).success).toBe(true);
  });
});

describe("DeathSchema", () => {
  it("rejects an unknown status", () => {
    expect(
      DeathSchema.safeParse({
        status: "zombie",
        daysSincePush: 1,
        flatlineMonth: null,
        reason: "x",
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed flatline month", () => {
    expect(
      DeathSchema.safeParse({
        status: "dead",
        daysSincePush: 1,
        flatlineMonth: "not-a-month",
        reason: "x",
      }).success,
    ).toBe(false);
  });
});

const validAutopsy: Autopsy = {
  epitaph: "It shipped, and then no one came.",
  causes: [
    {
      label: "Maintainer abandonment",
      confidencePct: 82,
      evidence: [{ type: "commit", ref: "a1b2c3d" }],
    },
    {
      label: "Unmerged work",
      confidencePct: 50,
      evidence: [{ type: "branch", ref: "feature/x" }],
    },
  ],
  revival: [
    { step: "Merge the dangling branch", effort: "1 day" },
    { step: "Triage open issues", effort: "3 days" },
    { step: "Cut a fresh release", effort: "1 hour" },
  ],
  lastWordsGloss: "// the todo was never fixed",
};

describe("AutopsySchema", () => {
  it("accepts a well-formed autopsy", () => {
    expect(AutopsySchema.safeParse(validAutopsy).success).toBe(true);
  });

  it("requires at least 2 causes", () => {
    expect(
      AutopsySchema.safeParse({ ...validAutopsy, causes: [validAutopsy.causes[0]] })
        .success,
    ).toBe(false);
  });

  it("allows at most 4 causes", () => {
    const causes = Array.from({ length: 5 }, () => validAutopsy.causes[0]);
    expect(AutopsySchema.safeParse({ ...validAutopsy, causes }).success).toBe(false);
  });

  it("rejects a confidence over 100", () => {
    const causes = [{ ...validAutopsy.causes[0], confidencePct: 101 }, validAutopsy.causes[1]];
    expect(AutopsySchema.safeParse({ ...validAutopsy, causes }).success).toBe(false);
  });

  it("rejects a fractional confidence", () => {
    const causes = [{ ...validAutopsy.causes[0], confidencePct: 1.5 }, validAutopsy.causes[1]];
    expect(AutopsySchema.safeParse({ ...validAutopsy, causes }).success).toBe(false);
  });

  it("requires at least 3 revival steps", () => {
    expect(
      AutopsySchema.safeParse({ ...validAutopsy, revival: validAutopsy.revival.slice(0, 2) })
        .success,
    ).toBe(false);
  });

  it("allows at most 5 revival steps", () => {
    const revival = Array.from({ length: 6 }, () => validAutopsy.revival[0]);
    expect(AutopsySchema.safeParse({ ...validAutopsy, revival }).success).toBe(false);
  });

  it("rejects an empty epitaph", () => {
    expect(AutopsySchema.safeParse({ ...validAutopsy, epitaph: "" }).success).toBe(
      false,
    );
  });
});

describe("EvidenceRefSchema", () => {
  it("accepts each known evidence type", () => {
    for (const type of ["commit", "issue", "branch", "file", "readme"] as const) {
      expect(EvidenceRefSchema.safeParse({ type, ref: "x" }).success).toBe(true);
    }
  });

  it("rejects an unknown type", () => {
    expect(EvidenceRefSchema.safeParse({ type: "gist", ref: "x" }).success).toBe(false);
  });

  it("rejects an empty ref", () => {
    expect(EvidenceRefSchema.safeParse({ type: "commit", ref: "" }).success).toBe(false);
  });
});

describe("CANONICAL_REFUSAL", () => {
  it("is the exact spec string the evals compare against", () => {
    expect(CANONICAL_REFUSAL).toBe(
      "I cannot say. The evidence is silent on that, and I do not invent.",
    );
  });
});
