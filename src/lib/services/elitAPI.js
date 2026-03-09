// web/src/lib/services/elitAPI.js

import axios from "axios";
import { cacheGet as redisCacheGet, cacheSet as redisCacheSet } from "@/lib/cache/redisCache";

const BASE_URL = "https://clientes.elit.com.ar/v1/api";

/**
 * Detecta si el query parece un SKU
 * Regla simple y efectiva:
 * - no espacios
 * - tiene al menos un número
 */
function isSku(query = "") {
  const q = String(query).trim();
  return q && !q.includes(" ") && /\d/.test(q);
}

function getCreds() {
  const ELIT_USER_ID = process.env.ELIT_USER_ID;
  const ELIT_TOKEN = process.env.ELIT_TOKEN;

  if (!ELIT_USER_ID || !ELIT_TOKEN) {
    console.warn("❌ Elit → Falta ELIT_USER_ID o ELIT_TOKEN");
    return null;
  }

  return {
    user_id: Number(ELIT_USER_ID),
    token: String(ELIT_TOKEN).trim(),
  };
}

// -------------------------------
// Cache local (memoria)
// -------------------------------
const ELIT_LOCAL_TTL_MS = 15 * 60 * 1000; // 15 min
const ELIT_REDIS_TTL_S = 15 * 60; // 15 min
const ELIT_MAX_KEYS = 500; // guardrail para no crecer infinito

let elitLocalCache = new Map(); // key -> { ts, data }
let ELIT_BLOCKED_UNTIL = 0;

function now() {
  return Date.now();
}

function isBlocked() {
  return now() < ELIT_BLOCKED_UNTIL;
}

function backoff(ms) {
  ELIT_BLOCKED_UNTIL = now() + ms;
}

function localCacheGetEntry(key) {
  const entry = elitLocalCache.get(key);
  if (!entry) return { hit: false, value: null };

  if (now() - entry.ts > ELIT_LOCAL_TTL_MS) {
    elitLocalCache.delete(key);
    return { hit: false, value: null };
  }

  return { hit: true, value: entry.data };
}

function localCacheSet(key, data) {
  if (elitLocalCache.size >= ELIT_MAX_KEYS) {
    const firstKey = elitLocalCache.keys().next().value;
    elitLocalCache.delete(firstKey);
  }

  elitLocalCache.set(key, {
    ts: now(),
    data,
  });
}

// =======================================================
// 🔎 BÚSQUEDA GENERAL (SKU o nombre)
// =======================================================
export async function fetchProductsFromElit(query = "") {
  const creds = getCreds();
  if (!creds) return [];

  const trimmed = String(query || "").trim();
  const cacheKey = `elit:q:${trimmed.toLowerCase() || "*"}`;

  // 1) cache local
  const { hit: localHit, value: localValue } = localCacheGetEntry(cacheKey);
  if (localHit) {
    console.log(
      `🟦 [Elit local HIT] "${trimmed}" → ${
        Array.isArray(localValue) ? localValue.length : 0
      }`
    );
    return localValue;
  }

  // 2) cache redis
  const redisHit = await redisCacheGet(cacheKey);
  if (redisHit !== null && redisHit !== undefined) {
    console.log(
      `🟦 [Elit redis HIT] "${trimmed}" → ${
        Array.isArray(redisHit) ? redisHit.length : 0
      }`
    );
    localCacheSet(cacheKey, redisHit);
    return redisHit;
  }

  // 3) backoff activo
  if (isBlocked()) {
    console.warn("🟦 [Elit] Backoff activo. Sin cache → []");
    return [];
  }

  const params = new URLSearchParams();
  params.set("limit", "100");

  if (trimmed) {
    if (isSku(trimmed)) params.set("codigo_producto", trimmed);
    else params.set("nombre", trimmed);
  }

  const url = `${BASE_URL}/productos?${params.toString()}`;

  try {
    console.log("🔵 [Elit MISS] URL:", url);

    const res = await axios.post(url, creds, {
      headers: { "Content-Type": "application/json" },
      timeout: 25000,
    });

    const results = Array.isArray(res.data?.resultado) ? res.data.resultado : [];

    localCacheSet(cacheKey, results);
    await redisCacheSet(cacheKey, results, ELIT_REDIS_TTL_S);

    return results;
  } catch (err) {
    const status = err?.response?.status;

    console.error("❌ Error Elit:", status, err.response?.data || err.message);

    if (status === 403 || status === 429) backoff(60 * 60 * 1000); // 1h
    else if (status >= 500) backoff(10 * 60 * 1000); // 10 min

    return [];
  }
}

// =======================================================
// 🔍 BÚSQUEDA EXACTA POR SKU (para /api/products/:sku)
// =======================================================
export async function fetchProductBySkuFromElit(sku) {
  const creds = getCreds();
  if (!creds) return null;

  const skuTrim = String(sku || "").trim();
  if (!skuTrim) return null;

  const cacheKey = `elit:sku:${skuTrim.toUpperCase()}`;

  // 1) cache local
  const { hit: localHit, value: localValue } = localCacheGetEntry(cacheKey);
  if (localHit) {
    console.log(`🟦 [Elit SKU local HIT] ${skuTrim}`);
    return localValue;
  }

  // 2) cache redis
  const redisHit = await redisCacheGet(cacheKey);
  if (redisHit !== null && redisHit !== undefined) {
    console.log(`🟦 [Elit SKU redis HIT] ${skuTrim}`);
    localCacheSet(cacheKey, redisHit);
    return redisHit;
  }

  // 3) backoff activo
  if (isBlocked()) {
    console.warn("🟦 [Elit SKU] Backoff activo. Sin cache → null");
    return null;
  }

  const url = `${BASE_URL}/productos?limit=100&codigo_producto=${encodeURIComponent(
    skuTrim
  )}`;

  try {
    console.log("🔵 [Elit SKU MISS] URL:", url);

    const res = await axios.post(url, creds, {
      headers: { "Content-Type": "application/json" },
      timeout: 25000,
    });

    const products = Array.isArray(res.data?.resultado) ? res.data.resultado : [];
    const result = products.length > 0 ? products[0] : null;

    localCacheSet(cacheKey, result);
    await redisCacheSet(cacheKey, result, ELIT_REDIS_TTL_S);

    return result;
  } catch (err) {
    const status = err?.response?.status;

    console.error("❌ Error SKU Elit:", status, err.response?.data || err.message);

    if (status === 403 || status === 429) backoff(60 * 60 * 1000);
    else if (status >= 500) backoff(10 * 60 * 1000);

    return null;
  }
}