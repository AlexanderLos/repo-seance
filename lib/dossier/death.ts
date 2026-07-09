/**
 * Deterministic death determination (SPEC §3). This is intentionally NOT an LLM
 * task: the verdict must be reproducible and defensible.
 *
 *   dead   — archived, OR pushed_at more than 365 days ago
 *   dying  — pushed_at 180–365 days ago (inclusive)
 *   alive  — pushed_at within the last 180 days
 *
 * `now` is a parameter so callers (and tests) control the clock — the function
 * is pure and has no hidden dependency on the wall clock.
 */
import type { Death, MonthlyBucket } from "./types";

/** Everything `determineDeath` needs, and nothing more. */
export interface DeathInput {
  /** ISO-8601 `pushed_at` from the repo metadata. */
  pushedAt: string;
  /** GitHub's `archived` flag — an explicit tombstone from the owner. */
  archived: boolean;
  /** Monthly commit buckets, used to locate the flatline month. */
  monthly: MonthlyBucket[];
}

const DAY_MS = 86_400_000;
const DYING_THRESHOLD_DAYS = 180;
const DEAD_THRESHOLD_DAYS = 365;

/** The last month that still carried a pulse (≥1 commit), or null if none. */
function lastActiveMonth(monthly: MonthlyBucket[]): string | null {
  let latest: string | null = null;
  for (const bucket of monthly) {
    if (bucket.count >= 1 && (latest === null || bucket.month > latest)) {
      latest = bucket.month;
    }
  }
  return latest;
}

export function determineDeath(input: DeathInput, now: Date): Death {
  const pushedMs = new Date(input.pushedAt).getTime();
  // Clamp negatives (future push dates) to 0 so the verdict stays well-defined.
  const daysSincePush = Math.max(
    0,
    Math.floor((now.getTime() - pushedMs) / DAY_MS),
  );

  let status: Death["status"];
  let reason: string;

  if (input.archived) {
    status = "dead";
    reason = "Repository was archived by its owner.";
  } else if (daysSincePush > DEAD_THRESHOLD_DAYS) {
    status = "dead";
    reason = `No commit pushed in ${daysSincePush} days — over a year of silence.`;
  } else if (daysSincePush >= DYING_THRESHOLD_DAYS) {
    status = "dying";
    reason = `No commit pushed in ${daysSincePush} days — the pulse is fading.`;
  } else {
    status = "alive";
    reason = `Last commit ${daysSincePush} day${daysSincePush === 1 ? "" : "s"} ago. This one still breathes.`;
  }

  // A living repo has not flatlined; the dead and dying show their last pulse.
  const flatlineMonth =
    status === "alive" ? null : lastActiveMonth(input.monthly);

  return { status, daysSincePush, flatlineMonth, reason };
}
