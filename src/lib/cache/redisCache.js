import { redis } from "@/lib/cache/redis";

export async function cacheGet(key) {
  return await redis.get(key);
}

export async function cacheSet(key, value, ttlSeconds = 600) {
  return await redis.set(key, value, { ex: ttlSeconds });
}

export async function cacheDel(key) {
  return await redis.del(key);
}