import { describe, it, expect } from "vitest";
import { buildDeclineChart, declineCaption } from "../components/util/decline";
import type { MonthlyBucket } from "../lib/dossier/types";

describe("buildDeclineChart", () => {
  it("reports empty when there is no cadence at all", () => {
    const chart = buildDeclineChart({
      monthly: [],
      flatlineMonth: null,
      nowMonth: "2024-01",
    });
    expect(chart.empty).toBe(true);
    expect(chart.bars).toHaveLength(0);
    expect(chart.markerLeftPct).toBeNull();
  });

  it("fills the silence after the flatline and colors the zones", () => {
    const monthly: MonthlyBucket[] = [
      { month: "2023-01", count: 5 },
      { month: "2023-02", count: 4 },
      { month: "2023-03", count: 2 }, // flatline (last active)
    ];
    const chart = buildDeclineChart({
      monthly,
      flatlineMonth: "2023-03",
      nowMonth: "2023-06",
    });

    expect(chart.empty).toBe(false);
    // Jan..Jun 2023 = 6 bars (3 active + 3 back-filled silence).
    expect(chart.bars).toHaveLength(6);
    expect(chart.bars.map((b) => b.month)).toEqual([
      "2023-01",
      "2023-02",
      "2023-03",
      "2023-04",
      "2023-05",
      "2023-06",
    ]);
    // The three silent months are dead.
    expect(chart.bars.slice(3).every((b) => b.zone === "dead")).toBe(true);
    // The peak scales to full height; silent months are a hairline.
    expect(chart.bars[0].heightPct).toBe(100);
    expect(chart.bars[3].heightPct).toBe(0);
    // Marker sits on the boundary after the flatline bar (3 of 6 → 50%).
    expect(chart.markerLeftPct).toBe(50);
    // The flatline's year is daggered.
    expect(chart.years).toEqual([{ label: 2023, dagger: true }]);
  });

  it("caps the window at 60 bars for a long-lived repo", () => {
    const monthly: MonthlyBucket[] = [];
    for (let i = 0; i < 80; i++) {
      const year = 2016 + Math.floor(i / 12);
      const month = (i % 12) + 1;
      monthly.push({
        month: `${year}-${String(month).padStart(2, "0")}`,
        count: 3,
      });
    }
    const last = monthly[monthly.length - 1].month;
    const chart = buildDeclineChart({
      monthly,
      flatlineMonth: last,
      nowMonth: last,
    });
    expect(chart.bars.length).toBeLessThanOrEqual(60);
    expect(chart.bars.length).toBe(60);
  });
});

describe("declineCaption", () => {
  it("states an honest final-year drop when the data supports one", () => {
    const monthly: MonthlyBucket[] = [
      { month: "2022-06", count: 100 }, // prior year window
      { month: "2023-06", count: 10 }, // final year window
    ];
    const caption = declineCaption({
      monthly,
      flatlineMonth: "2023-12",
      daysSincePush: 200,
    });
    expect(caption).toContain("90%");
    expect(caption).toContain("200 days");
  });

  it("falls back gracefully with no flatline", () => {
    const caption = declineCaption({
      monthly: [{ month: "2020-01", count: 1 }],
      flatlineMonth: null,
      daysSincePush: 42,
    });
    expect(caption).toContain("42 days");
    expect(caption).not.toContain("%");
  });
});
