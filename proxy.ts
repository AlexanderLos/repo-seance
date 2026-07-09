/**
 * Root proxy (Next 16's rename of middleware) — rate limits the séance chat only
 * (SPEC §5). Workstream D.
 *
 * 20 requests / IP / hour. Upstash sliding-window when `UPSTASH_REDIS_REST_*` are
 * present; otherwise an in-memory fixed-window Map that works per-instance for
 * local dev. Over the limit → 429 with the in-world message and a `Retry-After`.
 *
 * `next/server` is imported for types only, and the handler returns a plain
 * `Response` (or `undefined` to continue), so this module drags in no server
 * runtime — the pure limiter below is importable and unit-testable on its own.
 */
import type { NextRequest } from "next/server";

/** Requests allowed per IP per window. */
export const RATE_LIMIT = 20;
/** Window length in milliseconds (one hour). */
export const RATE_WINDOW_MS = 60 * 60 * 1000;

/** Only the chat endpoint is limited. */
export const config = {
  matcher: ["/api/chat", "/api/chat/:path*"],
};

export interface RateLimitDecision {
  success: boolean;
  remaining: number;
  /** Unix ms at which this IP's window resets. */
  resetAt: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** Per-instance fixed-window counters. Adequate for local dev / single instance. */
const buckets = new Map<string, Bucket>();

/**
 * Fixed-window limiter. Pure but for the module-level `buckets` map, and driven
 * by an injected `now` so tests own the clock.
 */
export function inMemoryRateLimit(
  key: string,
  now: number,
  limit: number = RATE_LIMIT,
  windowMs: number = RATE_WINDOW_MS,
): RateLimitDecision {
  const existing = buckets.get(key);
  if (existing === undefined || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: Math.max(0, limit - 1), resetAt };
  }
  if (existing.count >= limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return {
    success: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Clear all in-memory counters. For tests and reconfiguration only. */
export function resetInMemoryRateLimit(): void {
  buckets.clear();
}

/** The Upstash limiter, resolved once. `null` once we know env is absent. */
interface UpstashLimiter {
  limit(id: string): Promise<{ success: boolean; reset: number }>;
}
let upstashLimiter: UpstashLimiter | null | undefined;

async function getUpstashLimiter(): Promise<UpstashLimiter | null> {
  if (upstashLimiter !== undefined) return upstashLimiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    upstashLimiter = null;
    return null;
  }
  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");
  upstashLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(RATE_LIMIT, "1 h"),
    prefix: "seance:chat",
  });
  return upstashLimiter;
}

/** Best-effort client IP from proxy headers, else a shared `anon` bucket. */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anon";
}

export async function proxy(
  request: NextRequest,
): Promise<Response | undefined> {
  if (!request.nextUrl.pathname.startsWith("/api/chat")) {
    return undefined;
  }

  const ip = clientIp(request);
  let success: boolean;
  let resetAt: number;

  const limiter = await getUpstashLimiter();
  if (limiter !== null) {
    const result = await limiter.limit(ip);
    success = result.success;
    resetAt = result.reset;
  } else {
    const result = inMemoryRateLimit(ip, Date.now());
    success = result.success;
    resetAt = result.resetAt;
  }

  if (success) {
    return undefined;
  }

  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return new Response(
    JSON.stringify({ error: "The spirits tire. Return within the hour." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}
