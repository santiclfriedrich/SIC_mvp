// web/src/lib/services/pcartsAPI.js
import axios from "axios";
import { cacheGet as redisCacheGet, cacheSet as redisCacheSet } from "@/lib/cache/redisCache";

function getPcartsConfig() {
  const BASE_URL =
    process.env.PCARTS_URL?.trim() || "https://api.pcarts.com/operations";
  const TOKEN = process.env.PCARTS_TOKEN?.trim();

  if (!TOKEN) {
    console.warn("❌ PCArts → Falta PCARTS_TOKEN");
    return null;
  }

  return { BASE_URL, TOKEN };
}

function buildHeaders(operation, token) {
  return {
    "content-type": "application/json",
    "x-session-token": token,
    operation: String(operation),
  };
}

// -------------------------------
// Cache dataset completo (local + redis)
// -------------------------------
let cacheCatalog = null;
let cacheStock = null;
let cacheAt = 0;

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min local
const DATASET_REDIS_TTL_S = 10 * 60; // 10 min redis

// -------------------------------
// Cache SKU exacto (local + redis)
// -------------------------------
let skuCache = new Map();
const SKU_CACHE_TTL_MS = 2 * 60 * 1000; // 2 min local
const SKU_REDIS_TTL_S = 5 * 60; // 5 min redis

function cacheValid() {
  return cacheAt && Date.now() - cacheAt < CACHE_TTL_MS;
}

function setCache({ catalog, stock }) {
  cacheCatalog = catalog;
  cacheStock = stock;
  cacheAt = Date.now();
}

function clearCache() {
  cacheCatalog = null;
  cacheStock = null;
  cacheAt = 0;
  skuCache = new Map();
}

function skuCacheGetEntry(key) {
  const entry = skuCache.get(key);
  if (!entry) return { hit: false, value: null };

  if (Date.now() - entry.ts > SKU_CACHE_TTL_MS) {
    skuCache.delete(key);
    return { hit: false, value: null };
  }

  return { hit: true, value: entry.data };
}

function skuCacheSet(key, data) {
  skuCache.set(key, {
    ts: Date.now(),
    data,
  });
}

// -------------------------------
// Operación 1005 → Catálogo
// -------------------------------
async function fetchPcartsCatalog() {
  const cfg = getPcartsConfig();
  if (!cfg) return [];

  const headers = buildHeaders(1005, cfg.TOKEN);
  const params = { offset: 0, limit: 5000 };

  try {
    const res = await axios.get(cfg.BASE_URL, {
      headers,
      params,
      timeout: 30000,
    });
    return Array.isArray(res.data?.Products) ? res.data.Products : [];
  } catch (err) {
    console.error(
      "❌ PCArts 1005 (Catálogo) error:",
      err.response?.data || err.message
    );
    return [];
  }
}

// -------------------------------
// Operación 1004 → Stock + Precio
// -------------------------------
async function fetchPcartsStock() {
  const cfg = getPcartsConfig();
  if (!cfg) return [];

  const headers = buildHeaders(1004, cfg.TOKEN);
  const params = { offset: 0, limit: 5000 };

  try {
    const res = await axios.get(cfg.BASE_URL, {
      headers,
      params,
      timeout: 30000,
    });
    return Array.isArray(res.data?.Products) ? res.data.Products : [];
  } catch (err) {
    console.error(
      "❌ PCArts 1004 (Stock) error:",
      err.response?.data || err.message
    );
    return [];
  }
}

// -------------------------------
// Dataset unificado cacheado
// - local
// - redis
// -------------------------------
async function getUnifiedPcartsDataset() {
  const redisCatalogKey = "pcarts:catalog:v1";
  const redisStockKey = "pcarts:stock:v1";

  // 1) local cache
  if (cacheValid() && Array.isArray(cacheCatalog) && Array.isArray(cacheStock)) {
    console.log(
      `🟦 [PCArts local HIT] catálogo: ${cacheCatalog.length}, stock: ${cacheStock.length}`
    );
    return { catalog: cacheCatalog, stock: cacheStock };
  }

  // 2) redis cache
  const [redisCatalog, redisStock] = await Promise.all([
    redisCacheGet(redisCatalogKey),
    redisCacheGet(redisStockKey),
  ]);

  if (
    Array.isArray(redisCatalog) &&
    Array.isArray(redisStock) &&
    redisCatalog.length >= 0 &&
    redisStock.length >= 0
  ) {
    console.log(
      `🟦 [PCArts redis HIT] catálogo: ${redisCatalog.length}, stock: ${redisStock.length}`
    );
    setCache({ catalog: redisCatalog, stock: redisStock });
    return { catalog: redisCatalog, stock: redisStock };
  }

  // 3) request real
  console.log("🔵 [PCArts MISS] consultando 1004 + 1005...");

  const [catalog, stock] = await Promise.all([
    fetchPcartsCatalog(),
    fetchPcartsStock(),
  ]);

  setCache({ catalog, stock });

  await Promise.all([
    redisCacheSet(redisCatalogKey, catalog, DATASET_REDIS_TTL_S),
    redisCacheSet(redisStockKey, stock, DATASET_REDIS_TTL_S),
  ]);

  return { catalog, stock };
}

// -------------------------------
// FUNCIÓN PRINCIPAL
// -------------------------------
export async function fetchProductsFromPcarts(query = "") {
  try {
    const { catalog, stock } = await getUnifiedPcartsDataset();

    console.log(`🔵 PCArts → Catálogo: ${catalog.length}, Stock: ${stock.length}`);

    // Indexamos stock/precio por SKU
    const stockMap = new Map();
    for (const s of stock) {
      if (!s?.sku) continue;
      stockMap.set(s.sku, {
        price: Number(s.price) || 0,
        stock: Number(s.stock) || 0,
        sku_date_updated: s.sku_date_updated || null,
      });
    }

    // Unificamos tomando como base el catálogo
    let unified = catalog.map((c) => {
      const sInfo = stockMap.get(c.sku) || {};
      return {
        ...c,
        price: sInfo.price ?? 0,
        stock: sInfo.stock ?? 0,
        sku_date_updated: sInfo.sku_date_updated ?? null,
      };
    });

    if (!query) return unified;

    const q = String(query).trim().toLowerCase();
    if (!q) return unified;

    unified = unified.filter((p) => {
      return (
        String(p.sku || "").toLowerCase().includes(q) ||
        String(p.sku_desc || "").toLowerCase().includes(q)
      );
    });

    return unified;
  } catch (err) {
    console.error("❌ Error general PCArts:", err.response?.data || err.message);
    return [];
  }
}

// -------------------------------
// SKU exacto (local + redis)
// -------------------------------
export async function fetchProductBySkuFromPcarts(sku) {
  const SKU = String(sku || "").trim();
  if (!SKU) return null;

  const cacheKey = `pcarts:sku:${SKU.toUpperCase()}`;

  // 1) local cache
  const { hit: localHit, value: localValue } = skuCacheGetEntry(cacheKey);
  if (localHit) {
    console.log(`🟦 [PCArts SKU local HIT] ${SKU}`);
    return localValue;
  }

  // 2) redis cache
  const redisHit = await redisCacheGet(cacheKey);
  if (redisHit !== null && redisHit !== undefined) {
    console.log(`🟦 [PCArts SKU redis HIT] ${SKU}`);
    skuCacheSet(cacheKey, redisHit);
    return redisHit;
  }

  const cfg = getPcartsConfig();
  if (!cfg) return null;

  try {
    console.log(`🔵 [PCArts SKU MISS] ${SKU}`);

    const headersCatalog = buildHeaders(1005, cfg.TOKEN);
    const headersStock = buildHeaders(1004, cfg.TOKEN);

    const params = { offset: 0, limit: 100, sku: SKU };

    const [catRes, stockRes] = await Promise.all([
      axios.get(cfg.BASE_URL, {
        headers: headersCatalog,
        params,
        timeout: 30000,
      }),
      axios.get(cfg.BASE_URL, {
        headers: headersStock,
        params,
        timeout: 30000,
      }),
    ]);

    const catalog = Array.isArray(catRes.data?.Products)
      ? catRes.data.Products
      : [];

    if (catalog.length === 0) {
      skuCacheSet(cacheKey, null);
      await redisCacheSet(cacheKey, null, SKU_REDIS_TTL_S);
      return null;
    }

    const product = catalog[0];

    const stockList = Array.isArray(stockRes.data?.Products)
      ? stockRes.data.Products
      : [];

    const stockInfo = stockList[0] || {};

    const result = {
      ...product,
      price: Number(stockInfo.price) || 0,
      stock: Number(stockInfo.stock) || 0,
      sku_date_updated: stockInfo.sku_date_updated || null,
    };

    skuCacheSet(cacheKey, result);
    await redisCacheSet(cacheKey, result, SKU_REDIS_TTL_S);

    return result;
  } catch (err) {
    console.error(
      "❌ Error en fetchProductBySkuFromPcarts:",
      err.response?.data || err.message
    );
    return null;
  }
}

// Opcional: para forzar refresh desde algún endpoint admin interno
export function __pcartsClearCacheForDebug() {
  clearCache();
}