import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatYear,
  formatAge,
  formatDays,
  formatCount,
  formatMonthLabel,
  caseNumber,
  shortSha,
  shortAge,
} from "../components/util/format";

describe("date formatters", () => {
  it("formats an ISO instant as a UTC calendar date", () => {
    expect(formatDate("2022-12-15T12:00:00Z")).toBe("Dec 15, 2022");
  });

  it("extracts the UTC year", () => {
    expect(formatYear("2019-01-12T00:00:00Z")).toBe(2019);
    expect(formatYear("not-a-date")).toBeNull();
  });

  it("labels a month bucket", () => {
    expect(formatMonthLabel("2022-10")).toBe("Oct 2022");
    expect(formatMonthLabel("garbage")).toBe("garbage");
  });

  it("returns empty string for an unparseable date", () => {
    expect(formatDate("nonsense")).toBe("");
  });
});

describe("formatAge", () => {
  it("computes whole-calendar age, borrowing a month by day-of-month", () => {
    expect(formatAge("2019-01-12T00:00:00Z", "2023-11-03T00:00:00Z")).toBe(
      "4y 9m",
    );
  });

  it("drops the year component under a year", () => {
    expect(formatAge("2023-01-01T00:00:00Z", "2023-05-01T00:00:00Z")).toBe("4m");
  });

  it("is empty when the end precedes the start", () => {
    expect(formatAge("2023-05-01T00:00:00Z", "2023-01-01T00:00:00Z")).toBe("");
  });
});

describe("count and day helpers", () => {
  it("pluralizes days", () => {
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(570)).toBe("570 days");
  });

  it("groups thousands", () => {
    expect(formatCount(1204)).toBe("1,204");
  });
});

describe("caseNumber", () => {
  it("is a stable 4-digit fingerprint", () => {
    const a = caseNumber("atom/atom");
    expect(a).toBe(caseNumber("atom/atom"));
    expect(a).toMatch(/^\d{4}$/);
    // Different repos generally differ.
    expect(caseNumber("atom/atom")).not.toBe(caseNumber("vercel/next.js"));
  });
});

describe("sha and relative age", () => {
  it("shortens a sha to 7 chars", () => {
    expect(shortSha("a1b2c3d4e5f6")).toBe("a1b2c3d");
  });

  it("summarizes coarse relative age", () => {
    expect(shortAge("2022-01-01T00:00:00Z", "2023-06-01T00:00:00Z")).toBe("1y");
    expect(shortAge("2023-01-01T00:00:00Z", "2023-03-15T00:00:00Z")).toBe("2mo");
    expect(shortAge("2023-06-01T00:00:00Z", "2023-06-03T00:00:00Z")).toBe("2d");
    expect(shortAge("2023-06-01T00:00:00Z", "2023-06-01T05:00:00Z")).toBe("today");
  });
});
