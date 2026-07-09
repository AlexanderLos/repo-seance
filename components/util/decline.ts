/**
 * Turn the Dossier's real monthly commit counts into the mock's 60-bar decline
 * chart (DESIGN-NOTES §7.2). The mock hardcodes a rise → plateau → decay →
 * silence shape; here that shape emerges from actual data:
 *
 *   • one bar per calendar month, gaps back-filled with zero-commit months so
 *     the silence after death is visible;
 *   • the window is focused on the repo's recent life plus a short death tail,
 *     capped at 60 bars, so a repo dead for years doesn't render as a wall of
 *     empty bars;
 *   • bars are colored alive / decay / dead around the deterministic flatline
 *     month (SPEC §3 — flatline = last month with a pulse), not a fixed index.
 *
 * Pure and unit-tested (tests/ui-decline).
 */
import type { MonthlyBucket } from "../../lib/dossier/types";

export type DeclineZone = "alive" | "decay" | "dead";

export interface DeclineBar {
  /** `YYYY-MM` key for this bar. */
  month: string;
  /** 0–100 height percentage (0 renders as a 1px sliver of silence). */
  heightPct: number;
  /** Commits in this month — for the bar's title/tooltip. */
  count: number;
  zone: DeclineZone;
}

export interface DeclineChart {
  bars: DeclineBar[];
  /** Left offset (%) for the flatline marker, or null when nothing to mark. */
  markerLeftPct: number | null;
  /** Distinct year labels spanning the window; the death year carries a dagger. */
  years: { label: number; dagger: boolean }[];
  /** True when there was no cadence to chart at all. */
  empty: boolean;
}

const MAX_BARS = 60;
/** Months of silence to reveal after the flatline before we stop drawing. */
const SILENCE_TAIL = 6;
/** Share of the active span painted as the dim-gold "decay" tail. */
const DECAY_SHARE = 0.15;

function monthToIndex(month: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (m === null) return null;
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}

function indexToMonth(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export interface DeclineInput {
  monthly: MonthlyBucket[];
  flatlineMonth: string | null;
  /** Current month (`YYYY-MM`, from the Dossier's fetch time) — caps the tail. */
  nowMonth: string;
}

export function buildDeclineChart(input: DeclineInput): DeclineChart {
  const counts = new Map<number, number>();
  for (const bucket of input.monthly) {
    const idx = monthToIndex(bucket.month);
    if (idx !== null) counts.set(idx, (counts.get(idx) ?? 0) + bucket.count);
  }

  const activeIndices = [...counts.entries()]
    .filter(([, c]) => c > 0)
    .map(([i]) => i);

  if (activeIndices.length === 0) {
    return { bars: [], markerLeftPct: null, years: [], empty: true };
  }

  const firstData = Math.min(...counts.keys());
  const lastData = Math.max(...counts.keys());
  const flatlineIdx = input.flatlineMonth
    ? monthToIndex(input.flatlineMonth)
    : Math.max(...activeIndices);
  const nowIdx = monthToIndex(input.nowMonth) ?? lastData;

  // End the window a short, bounded stretch of silence past the flatline —
  // never into the future, always at least far enough to show the last data.
  const anchor = flatlineIdx ?? lastData;
  let endIdx = Math.min(nowIdx, anchor + SILENCE_TAIL);
  if (endIdx < lastData) endIdx = lastData;

  // Start ≤60 months back, but not before we have data.
  const startIdx = Math.max(firstData, endIdx - (MAX_BARS - 1));

  const windowIndices: number[] = [];
  for (let i = startIdx; i <= endIdx; i++) windowIndices.push(i);

  const windowCounts = windowIndices.map((i) => counts.get(i) ?? 0);
  const maxCount = Math.max(1, ...windowCounts);

  // The decay tail: the final slice of active (≤ flatline) months in view.
  const activeInWindow = windowIndices.filter(
    (i) => flatlineIdx === null || i <= flatlineIdx,
  );
  const decayCount = Math.min(
    activeInWindow.length,
    Math.max(1, Math.round(activeInWindow.length * DECAY_SHARE)),
  );
  const decayStartIdx =
    activeInWindow.length > 0
      ? activeInWindow[activeInWindow.length - decayCount]
      : Number.POSITIVE_INFINITY;

  const bars: DeclineBar[] = windowIndices.map((i, pos) => {
    const count = windowCounts[pos];
    let zone: DeclineZone;
    if (flatlineIdx !== null && i > flatlineIdx) {
      zone = "dead";
    } else if (i >= decayStartIdx) {
      zone = "decay";
    } else {
      zone = "alive";
    }
    // Active months get a visible floor; silent months stay a hairline.
    const heightPct =
      count === 0 ? 0 : Math.max(6, Math.round((count / maxCount) * 100));
    return { month: indexToMonth(i), heightPct, count, zone };
  });

  // Marker sits on the boundary between the last active bar and the silence.
  let markerLeftPct: number | null = null;
  if (flatlineIdx !== null && bars.length > 0) {
    const flatlinePos = windowIndices.indexOf(flatlineIdx);
    const boundary = flatlinePos >= 0 ? flatlinePos + 1 : bars.length;
    markerLeftPct = Math.min(100, (boundary / bars.length) * 100);
  }

  // Distinct years in view; the flatline's year is daggered.
  const flatlineYear =
    flatlineIdx !== null ? Math.floor(flatlineIdx / 12) : null;
  const seen = new Set<number>();
  const years: { label: number; dagger: boolean }[] = [];
  for (const i of windowIndices) {
    const year = Math.floor(i / 12);
    if (!seen.has(year)) {
      seen.add(year);
      years.push({ label: year, dagger: year === flatlineYear });
    }
  }

  return { bars, markerLeftPct, years, empty: false };
}

/**
 * An honest one-line caption for the chart. States a real final-year cadence
 * drop when the data supports one, plus the deterministic silence length —
 * never the mock's invented "91%". All numbers flow from the Dossier.
 */
export function declineCaption(input: {
  monthly: MonthlyBucket[];
  flatlineMonth: string | null;
  daysSincePush: number;
}): string {
  const silence = `${input.daysSincePush.toLocaleString("en-US")} days of silence since.`;

  const flatlineIdx = input.flatlineMonth
    ? monthToIndex(input.flatlineMonth)
    : null;
  if (flatlineIdx === null) return `The cadence stopped. ${silence}`;

  const counts = new Map<number, number>();
  for (const b of input.monthly) {
    const idx = monthToIndex(b.month);
    if (idx !== null) counts.set(idx, (counts.get(idx) ?? 0) + b.count);
  }
  const sum = (from: number, to: number): number => {
    let total = 0;
    for (let i = from; i <= to; i++) total += counts.get(i) ?? 0;
    return total;
  };

  const finalYear = sum(flatlineIdx - 11, flatlineIdx);
  const priorYear = sum(flatlineIdx - 23, flatlineIdx - 12);

  if (priorYear > 0 && finalYear < priorYear) {
    const dropPct = Math.round((1 - finalYear / priorYear) * 100);
    if (dropPct > 0) {
      return `Cadence fell ${dropPct}% in the final year. ${silence}`;
    }
  }
  return `The pulse ran out. ${silence}`;
}
