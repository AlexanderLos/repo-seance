import { describe, it, expect, vi, afterEach } from "vitest";
import {
  LruStore,
  UpstashStore,
  getCache,
  resetCache,
  type CacheStore,
} from "../lib/cache";
import { dossierKey, autopsyKey, TTL_24H } from "../lib/cache/keys";

afterEach(() => {
  vi.unstubAllEnvs();
  resetCache();
});

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("LruStore", () => {
  it("round-trips an object value", async () => {
    const store: CacheStore = new LruStore();
    await store.set("k", { a: 1, b: "two" }, 60);
    expect(await store.get<{ a: number; b: string }>("k")).toEqual({
      a: 1,
      b: "two",
    });
  });

  it("returns null for a missing key", async () => {
    const store = new LruStore();
    expect(await store.get("nope")).toBeNull();
  });

  it("expires entries after their TTL", async () => {
    const store = new LruStore();
    await store.set("short", "value", 0.05); // 50ms
    expect(await store.get("short")).toBe("value");
    await sleep(150);
    expect(await store.get("short")).toBeNull();
  });
});

describe("cache keys", () => {
  it("builds the dossier key verbatim", () => {
    expect(dossierKey("atom", "atom")).toBe("dossier:atom/atom:v1");
  });

  it("builds the autopsy key verbatim", () => {
    expect(autopsyKey("facebook", "react")).toBe("autopsy:facebook/react:v1");
  });

  it("uses a 24h TTL of 86400 seconds", () => {
    expect(TTL_24H).toBe(86_400);
  });
});

describe("getCache selection", () => {
  it("falls back to the in-memory LRU when Upstash env is absent", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    resetCache();
    expect(getCache()).toBeInstanceOf(LruStore);
  });

  it("uses Upstash when both env vars are present", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake-instance.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "faketoken");
    resetCache();
    expect(getCache()).toBeInstanceOf(UpstashStore);
  });

  it("returns the same singleton instance across calls", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    resetCache();
    expect(getCache()).toBe(getCache());
  });
});
