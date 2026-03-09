// web/src/lib/services/corcisaAPI.js
import axios from "axios";
import fs from "fs";
import { cacheGet as redisCacheGet, cacheSet as redisCacheSet } from "@/lib/cache/redisCache";

const BASE_URL = "https://corcisa.com.ar/api/v1/productos";

/** ===== Cache config ===== */
const CORCISA_CATALOG_TTL_MS = 30 * 60 * 1000; // 30 min local
const CORCISA_CATALOG_REDIS_TTL_S = 30 * 60; // 30 min redis
const CORCISA_CACHE_FILE = "/tmp/corcisa_catalog_cache.json";

const CORCISA_SKU_LOCAL_TTL_MS = 10 * 60 * 1000; // 10 min
const CORCISA_SKU_REDIS_TTL_S = 10 * 60; // 10 min

let CORCISA_CATALOG_CACHE = {
  ts: 0,
  items: [],
};

const corcisaSkuLocalCache = new Map(); // key -> { ts, value }
let CORCISA_BLOCKED_UNTIL = 0;

function now() {
  return Date.now();
}

function isBlocked() {
  return now() < CORCISA_BLOCKED_UNTIL;
}

function backoff(ms) {
  CORCISA_BLOCKED_UNTIL = now() + ms;
}

function readCatalogCacheFile() {
  try {
    if (!fs.existsSync(CORCISA_CACHE_FILE)) return null;
    const raw = fs.readFileSync(CORCISA_CACHE_FILE, "utf8");
    const json = JSON.parse(raw);
    if (!json?.ts || !Array.isArray(json?.items)) return null;
    return json;
  } catch {
    return null;
  }
}

function writeCatalogCacheFile(ts, items) {
  try {
    fs.writeFileSync(CORCISA_CACHE_FILE, JSON.stringify({ ts, items }), "utf8");
  } catch {
    // noop
  }
}

export function clearCorcisaCatalogCache() {
  CORCISA_CATALOG_CACHE = { ts: 0, items: [] };
  try {
    if (fs.existsSync(CORCISA_CACHE_FILE)) fs.unlinkSync(CORCISA_CACHE_FILE);
  } catch {
    // noop
  }
}

function skuLocalGetEntry(key) {
  const entry = corcisaSkuLocalCache.get(key);
  if (!entry) return { hit: false, value: null };

  if (Date.now() - entry.ts > CORCISA_SKU_LOCAL_TTL_MS) {
    corcisaSkuLocalCache.delete(key);
    return { hit: false, value: null };
  }

  return { hit: true, value: entry.value };
}

function skuLocalSet(key, value) {
  corcisaSkuLocalCache.set(key, { ts: Date.now(), value });
}

function isSku(query = "") {
  const q = String(query).trim();
  return q && !q.includes(" ") && /[0-9]/.test(q) && /[A-Z0-9/-]/i.test(q);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function corcisaPost({ params, body, timeoutMs = 15000 }) {
  const res = await axios.post(BASE_URL, body, {
    params,
    timeout: timeoutMs,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  });
  return res;
}

/**
 * ✅ Trae TODAS las páginas de Corcisa
 */
export async function fetchAllProductsFromCorcisa({
  limit = 100,
  actualizacion = null,
  maxPages = 5000,
  sleepMs = 150,
} = {}) {
  const CORCISA_USER_ID = process.env.CORCISA_USER_ID;
  const CORCISA_TOKEN = process.env.CORCISA_TOKEN;

  if (!CORCISA_USER_ID || !CORCISA_TOKEN) {
    console.error("❌ Corcisa → Falta CORCISA_USER_ID o CORCISA_TOKEN");
    return [];
  }

  const body = { user_id: CORCISA_USER_ID, token: CORCISA_TOKEN };

  let offset = 0;
  let page = 0;
  const all = [];

  while (page < maxPages) {
    page += 1;

    const params = { limit, offset };
    if (actualizacion) params.actualizacion = actualizacion;

    try {
      console.log(`🔵 [Corcisa] page ${page} limit ${limit} offset ${offset}`);

      const res = await corcisaPost({ params, body });
      const batch = Array.isArray(res.data?.resultado) ? res.data.resultado : [];

      all.push(...batch);

      console.log(`🟣 [Corcisa] batch: ${batch.length} acumulado: ${all.length}`);

      if (batch.length < limit) break;

      offset += limit;
      if (sleepMs) await sleep(sleepMs);
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      console.error("❌ Corcisa paginación error:", status, data || err?.message || err);

      if (status === 403 || status === 429) backoff(60 * 60 * 1000);
      else if (status >= 500) backoff(10 * 60 * 1000);

      break;
    }
  }

  return all;
}

/**
 * ✅ Catálogo cacheado (local + file + redis)
 */
export async function fetchAllProductsFromCorcisaCached({
  force = false,
  ttlMs = CORCISA_CATALOG_TTL_MS,
  limit = 100,
  actualizacion = null,
  maxPages = 5000,
  sleepMs = 150,
} = {}) {
  const t = now();
  const redisKey = "corcisa:catalog:v1";

  // 1) memoria
  if (
    !force &&
    CORCISA_CATALOG_CACHE.items.length &&
    t - CORCISA_CATALOG_CACHE.ts < ttlMs
  ) {
    console.log(`🟦 [Corcisa local HIT] catálogo: ${CORCISA_CATALOG_CACHE.items.length}`);
    return CORCISA_CATALOG_CACHE.items;
  }

  // 2) /tmp
  if (!force) {
    const file = readCatalogCacheFile();
    if (file?.items?.length && t - file.ts < ttlMs) {
      CORCISA_CATALOG_CACHE = file;
      console.log(`🟦 [Corcisa file HIT] catálogo: ${file.items.length}`);
      return file.items;
    }
  }

  // 3) redis
  if (!force) {
    const redisHit = await redisCacheGet(redisKey);
    if (redisHit && Array.isArray(redisHit) && redisHit.length) {
      CORCISA_CATALOG_CACHE = { ts: t, items: redisHit };
      writeCatalogCacheFile(t, redisHit);
      console.log(`🟦 [Corcisa redis HIT] catálogo: ${redisHit.length}`);
      return redisHit;
    }
  }

  // 4) si estamos bloqueados, devolver stale
  if (isBlocked()) {
    if (CORCISA_CATALOG_CACHE.items.length) {
      console.warn("🟦 [Corcisa] Backoff activo. Devolviendo catálogo de memoria (stale).");
      return CORCISA_CATALOG_CACHE.items;
    }

    const file = readCatalogCacheFile();
    if (file?.items?.length) {
      console.warn("🟦 [Corcisa] Backoff activo. Devolviendo catálogo de archivo (stale).");
      return file.items;
    }

    console.warn("🟦 [Corcisa] Backoff activo. Sin cache → []");
    return [];
  }

  // 5) request real
  console.log("🟦 [Corcisa MISS] refrescando catálogo...");
  const items = await fetchAllProductsFromCorcisa({
    limit,
    actualizacion,
    maxPages,
    sleepMs,
  });

  CORCISA_CATALOG_CACHE = { ts: now(), items };
  writeCatalogCacheFile(CORCISA_CATALOG_CACHE.ts, items);
  await redisCacheSet(redisKey, items, CORCISA_CATALOG_REDIS_TTL_S);

  console.log(`🟦 [Corcisa] catálogo cacheado: ${items.length}`);
  return items;
}

/**
 * 🔵 Búsqueda
 * - SKU: server-side + cache local + redis
 * - Nombre: catálogo cacheado + filtro local
 */
export async function fetchProductsFromCorcisa(query = "") {
  const CORCISA_USER_ID = process.env.CORCISA_USER_ID;
  const CORCISA_TOKEN = process.env.CORCISA_TOKEN;

  if (!CORCISA_USER_ID || !CORCISA_TOKEN) {
    console.error("❌ Corcisa → Falta CORCISA_USER_ID o CORCISA_TOKEN");
    return [];
  }

  const trimmed = String(query).trim();
  const body = { user_id: CORCISA_USER_ID, token: CORCISA_TOKEN };

  // 1) SKU: server-side + cache
  if (trimmed && isSku(trimmed)) {
    const skuKey = trimmed.trim().toUpperCase();
    const cacheKey = `corcisa:sku:list:${skuKey}`;

    // local
    const { hit: localHit, value: localValue } = skuLocalGetEntry(cacheKey);
    if (localHit) {
      console.log(
        `🟦 [Corcisa SKU local HIT] ${skuKey} → ${
          Array.isArray(localValue) ? localValue.length : 0
        }`
      );
      return localValue;
    }

    // redis
    const redisHit = await redisCacheGet(cacheKey);
    if (redisHit !== null && redisHit !== undefined) {
      console.log(
        `🟦 [Corcisa SKU redis HIT] ${skuKey} → ${
          Array.isArray(redisHit) ? redisHit.length : 0
        }`
      );
      skuLocalSet(cacheKey, redisHit);
      return redisHit;
    }

    const params = { limit: 100, offset: 0, codigo_producto: trimmed };
    console.log("🔵 [Corcisa SKU MISS] filtros →", {
      limit: params.limit,
      offset: params.offset,
      codigo_producto: params.codigo_producto,
    });

    try {
      const res = await corcisaPost({ params, body });
      const results = Array.isArray(res.data?.resultado) ? res.data.resultado : [];

      skuLocalSet(cacheKey, results);
      await redisCacheSet(cacheKey, results, CORCISA_SKU_REDIS_TTL_S);

      console.log(`🔵 [Corcisa] Resultados SKU: ${results.length}`);
      return results;
    } catch (err) {
      const status = err?.response?.status;
      console.error("❌ Error Corcisa SKU:", status, err?.response?.data || err?.message || err);

      if (status === 403 || status === 429) backoff(60 * 60 * 1000);
      else if (status >= 500) backoff(10 * 60 * 1000);

      return [];
    }
  }

  // 2) Nombre: catálogo cacheado + filtro local
  const all = await fetchAllProductsFromCorcisaCached({
    limit: 100,
    ttlMs: CORCISA_CATALOG_TTL_MS,
  });

  if (!trimmed) return all;

  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);

  const filtered = all.filter((p) => {
    const name = String(p?.nombre || "").toLowerCase();
    const brand = String(p?.marca || "").toLowerCase();
    const sku = String(p?.codigo_producto || "").toLowerCase();
    const hay = `${name} ${brand} ${sku}`;
    return words.every((w) => hay.includes(w));
  });

  console.log(`🔵 [Corcisa] Filtrados por "${trimmed}": ${filtered.length} (de ${all.length})`);
  return filtered;
}