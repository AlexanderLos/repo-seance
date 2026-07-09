import { describe, it, expect, beforeEach } from "vitest";
import {
  inMemoryRateLimit,
  resetInMemoryRateLimit,
  RATE_LIMIT,
  RATE_WINDOW_MS,
} from "../proxy";

describe("inMemoryRateLimit — fixed-window fallback (SPEC §5)", () => {
  beforeEach(() => {
    resetInMemoryRateLimit();
  });

  it("allows exactly RATE_LIMIT requests in a window, then blocks", () => {
    const now = 1_000;
    for (let i = 0; i < RATE_LIMIT; i += 1) {
      expect(inMemoryRateLimit("ip-a", now).success).toBe(true);
    }
    const blocked = inMemoryRateLimit("ip-a", now);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("counts remaining down from limit - 1", () => {
    expect(inMemoryRateLimit("ip-b", 0).remaining).toBe(RATE_LIMIT - 1);
    expect(inMemoryRateLimit("ip-b", 0).remaining).toBe(RATE_LIMIT - 2);
  });

  it("resets once the window has elapsed", () => {
    const start = 5_000;
    for (let i = 0; i < RATE_LIMIT; i += 1) inMemoryRateLimit("ip-c", start);
    expect(inMemoryRateLimit("ip-c", start).success).toBe(false);

    const after = inMemoryRateLimit("ip-c", start + RATE_WINDOW_MS);
    expect(after.success).toBe(true);
    expect(after.remaining).toBe(RATE_LIMIT - 1);
  });

  it("keeps each IP in its own bucket", () => {
    for (let i = 0; i < RATE_LIMIT; i += 1) inMemoryRateLimit("busy", 0);
    expect(inMemoryRateLimit("busy", 0).success).toBe(false);
    expect(inMemoryRateLimit("fresh", 0).success).toBe(true);
  });

  it("reports a resetAt one window ahead of the first hit", () => {
    const now = 42;
    const first = inMemoryRateLimit("ip-d", now);
    expect(first.resetAt).toBe(now + RATE_WINDOW_MS);
  });

  it("honours a custom limit argument", () => {
    expect(inMemoryRateLimit("ip-e", 0, 1).success).toBe(true);
    expect(inMemoryRateLimit("ip-e", 0, 1).success).toBe(false);
  });
});
