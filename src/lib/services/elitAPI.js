// web/src/lib/services/elitAPI.js

import axios from "axios";

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
    // En Next esto se lee de web/.env.local (solo server-side)
    console.warn("❌ Elit → Falta ELIT_USER_ID o ELIT_TOKEN");
    return null;
  }

  return {
    user_id: Number(ELIT_USER_ID),
    token: String(ELIT_TOKEN).trim(),
  };
}

// -------------------------------
// Cache por query (memoria)
// -------------------------------
const ELIT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 min
const ELIT_MAX_KEYS = 500; // guardrail para no crecer infinito

let elitCache = new Map(); // key -> { ts, data }
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

function cacheGet(key) {
  const hit = elitCache.get(key);
  if (!hit) return null;
  if (now() - hit.ts > ELIT_CACHE_TTL_MS) {
    elitCache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data) {
  // guardrail: si se llena, borramos el más viejo
  if (elitCache.size >= ELIT_MAX_KEYS) {
    const firstKey = elitCache.keys().next().value;
    elitCache.delete(firstKey);
  }
  elitCache.set(key, { ts: now(), data });
}

// =======================================================
// 🔎 BÚSQUEDA GENERAL (SKU o nombre)
// =======================================================
export async function fetchProductsFromElit(query = "") {
  const creds = getCreds();
  if (!creds) return [];

  const trimmed = String(query || "").trim();

  // clave de cache determinística
  const cacheKey = `q:${trimmed.toLowerCase() || "*"}`;

  // ✅ cache hit
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log(`🟦 [Elit cache HIT] "${trimmed}" → ${cached.length}`);
    return cached;
  }

  // ✅ backoff activo
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
    console.log("🔵 [Elit] URL:", url);

    const res = await axios.post(url, creds, {
      headers: { "Content-Type": "application/json" },
      timeout: 25000,
    });

    const results = Array.isArray(res.data?.resultado) ? res.data.resultado : [];

    cacheSet(cacheKey, results);
    return results;
  } catch (err) {
    const status = err?.response?.status;

    console.error("❌ Error Elit:", status, err.response?.data || err.message);

    // Backoff si rate-limit / forbidden
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

  const cacheKey = `sku:${skuTrim.toUpperCase()}`;

  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log(`🟦 [Elit SKU cache HIT] ${skuTrim}`);
    return cached?.[0] || null;
  }

  if (isBlocked()) return null;

  const url = `${BASE_URL}/productos?limit=100&codigo_producto=${encodeURIComponent(skuTrim)}`;

  try {
    const res = await axios.post(url, creds, {
      headers: { "Content-Type": "application/json" },
      timeout: 25000,
    });

    const products = Array.isArray(res.data?.resultado) ? res.data.resultado : [];
    cacheSet(cacheKey, products);

    return products.length > 0 ? products[0] : null;
  } catch (err) {
    const status = err?.response?.status;
    console.error("❌ Error SKU Elit:", status, err.response?.data || err.message);

    if (status === 403 || status === 429) backoff(60 * 60 * 1000);
    else if (status >= 500) backoff(10 * 60 * 1000);

    return null;
  }
}
