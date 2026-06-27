import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

// Upstash (production) fournit une REDIS_URL complète
// En local, on utilise host/port séparés
const redisConfig = process.env.REDIS_URL
  ? {
      // Format : rediss://default:password@host:port
      url: process.env.REDIS_URL,
      tls: process.env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
      retryStrategy: (times) => {
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
      },
      lazyConnect: true,
    }
  : {
      host:     env.REDIS_HOST,
      port:     env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        if (times > 5) {
          logger.error("Redis — trop de tentatives de reconnexion, abandon");
          return null;
        }
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true,
    };

const client = new Redis(redisConfig);

client.on("connect",      () => logger.info("Redis connecté"));
client.on("reconnecting", () => logger.warn("Redis — reconnexion en cours..."));
client.on("error",        (err) => logger.error("Redis error", { error: err.message }));

export const connectRedis = async () => {
  await client.connect();
  return client;
};

export const redis = client;

// Helpers cache
export const cache = {
  async get(key) {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  },

  async set(key, value, ttlSeconds = 300) {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  },

  async del(key) {
    await client.del(key);
  },

  async delPattern(pattern) {
    const keys = await client.keys(pattern);
    if (keys.length > 0) await client.del(...keys);
  },

  async incr(key, ttlSeconds = 60) {
    const val = await client.incr(key);
    if (val === 1) await client.expire(key, ttlSeconds);
    return val;
  },
};
