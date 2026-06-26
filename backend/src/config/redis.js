import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const REDIS_URL = process.env.REDIS_URL;

// Si pas de Redis configuré, on utilise un cache mémoire silencieux
const memCache = new Map();

const noopCache = {
  async get(key)                    { return memCache.get(key) ?? null; },
  async set(key, value, ttl = 300)  { memCache.set(key, value); setTimeout(() => memCache.delete(key), ttl * 1000); },
  async del(key)                    { memCache.delete(key); },
  async delPattern(pattern)         { const re = new RegExp(pattern.replace("*", ".*")); for (const k of memCache.keys()) if (re.test(k)) memCache.delete(k); },
  async incr(key)                   { const v = (memCache.get(key) || 0) + 1; memCache.set(key, v); return v; },
};

let client = null;
let cache  = noopCache;
let redis  = null;

if (REDIS_URL) {
  client = new Redis(REDIS_URL, {
    tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 500, 3000);
    },
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  client.on("connect", () => logger.info("Redis connecté"));
  client.on("error",   (err) => logger.warn("Redis indisponible — cache mémoire activé", { error: err.message }));

  redis = client;

  cache = {
    async get(key)                   { try { const v = await client.get(key); return v ? JSON.parse(v) : null; } catch { return null; } },
    async set(key, value, ttl = 300) { try { await client.set(key, JSON.stringify(value), "EX", ttl); } catch {} },
    async del(key)                   { try { await client.del(key); } catch {} },
    async delPattern(pattern)        { try { const keys = await client.keys(pattern); if (keys.length) await client.del(...keys); } catch {} },
    async incr(key, ttl = 60)        { try { const v = await client.incr(key); if (v === 1) await client.expire(key, ttl); return v; } catch { return 1; } },
  };
} else {
  logger.warn("REDIS_URL non défini — cache mémoire activé (données non persistées)");
}

export const connectRedis = async () => {
  if (client) {
    try { await client.connect(); } catch {}
  }
};

export { redis, cache };
export default client;
