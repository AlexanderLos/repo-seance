/**
 * Small, pure formatters for the autopsy chrome. Everything reads UTC so the
 * rendered dates are deterministic regardless of the viewer's timezone (the
 * numbers are eval-tested for fidelity, SPEC §7). No locale surprises.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** `2022-12-15T12:00:00Z` → `Dec 15, 2022`. Empty string on an unparseable date. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** `2022-12-15T…` → `2022`. Null on an unparseable date. */
export function formatYear(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

/** `2022-10` (YYYY-MM) → `Oct 2022`. Falls back to the raw key if malformed. */
export function formatMonthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (m === null) return month;
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return month;
  return `${MONTHS[idx]} ${m[1]}`;
}

/**
 * Whole-calendar age between two ISO instants as `4y 9m` (borrowing a month
 * when the day-of-month hasn't been reached). `0m` for sub-month spans; empty
 * string when either date is unparseable or `to` precedes `from`.
 */
export function formatAge(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "";
  if (to.getTime() < from.getTime()) return "";

  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let months = to.getUTCMonth() - from.getUTCMonth();
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0) return `${months}m`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}m`;
}

/** `n days` with singular/plural agreement (`1 day`). */
export function formatDays(n: number): string {
  return `${n.toLocaleString("en-US")} day${n === 1 ? "" : "s"}`;
}

/** Relative last-pulse label: `today` for 0, else `n days ago` (`1 day ago`). */
export function formatLastPulse(n: number): string {
  return n === 0 ? "today" : `${formatDays(n)} ago`;
}

/** `1204` → `1,204`. Thousands-grouped integer for vitals like stars/forks. */
export function formatCount(n: number): string {
  return Math.trunc(n).toLocaleString("en-US");
}

/**
 * A stable, decorative 4-digit case number derived from the repo's full name.
 * Pure flavor for the certificate eyebrow — not a statistic, just a fingerprint
 * so `atom/atom` always files under the same case.
 */
export function caseNumber(fullName: string): string {
  let hash = 0;
  for (let i = 0; i < fullName.length; i++) {
    hash = (hash * 31 + fullName.charCodeAt(i)) >>> 0;
  }
  return String(hash % 10000).padStart(4, "0");
}

/** Shorten a commit sha to its 7-char display form. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

/**
 * Coarse relative age between two ISO instants, as `2y` / `8mo` / `12d` /
 * `today`. Used for the compact meta columns. Empty string on bad input.
 */
export function shortAge(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "";
  const days = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
  if (days >= 365) return `${Math.floor(days / 365)}y`;
  if (days >= 30) return `${Math.floor(days / 30)}mo`;
  if (days >= 1) return `${days}d`;
  return "today";
}
