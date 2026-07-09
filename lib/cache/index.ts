/**
 * The cache abstraction (SPEC §2/§3). Upstash Redis in production; an in-memory
 * LRU fallback so local dev needs no Redis. `getCache()` picks Upstash only when
 * both Upstash env vars are present, and reads env lazily at call time so the
 * build never fails for want of a variable.
 */
import { LRUCache } from "lru-cache";
import { Redis } from "@upstash/redis";

/** A minimal typed key/value store with per-entry TTL. */
export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

/** Upstash Redis-backed store. Values are JSON-(de)serialized by the client. */
export class UpstashStore implements CacheStore {
  private readonly client: Redis;

  constructor(url: string, token: string) {
    this.client = new Redis({ url, token });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get<T>(key);
    return value ?? null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { ex: ttlSeconds });
  }
}

/** Wrapper so any value type (including null/primitives) can be cached. */
interface LruEntry {
  value: unknown;
}

/** In-memory LRU-backed store with per-entry TTL. Used when Redis is absent. */
export class LruStore implements CacheStore {
  private readonly cache: LRUCache<string, LruEntry>;

  constructor(max = 500) {
    this.cache = new LRUCache<string, LruEntry>({ max });
  }

  get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    return Promise.resolve(entry === undefined ? null : (entry.value as T));
  }

  set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.cache.set(key, { value }, { ttl: Math.max(0, ttlSeconds) * 1000 });
    return Promise.resolve();
  }
}

let store: CacheStore | null = null;

/**
 * Process-wide cache singleton. Upstash iff both env vars are present, else the
 * in-memory LRU. Env is read here (lazily), never at module import.
 */
export function getCache(): CacheStore {
  if (store !== null) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  store = url && token ? new UpstashStore(url, token) : new LruStore();
  return store;
}

/** Drop the singleton so the next `getCache()` re-reads env. For tests/reconfig. */
export function resetCache(): void {
  store = null;
}
