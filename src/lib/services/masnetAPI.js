// web/src/lib/services/masnetAPI.js
import axios from "axios";
import { getMasnetCatalogCached, isMasnetCatalogWarm } from "../cache/masnetCatalogCache"; // ✅ CSV+cache
import { cacheGet, cacheSet } from "@/lib/cache/redisCache";

function isSku(query = "") {
  const q = String(query).trim();
  return q && !q.includes(" ") && /\d/.test(q);
}

function getCreds() {
  const MASNET_USER_ID = process.env.MASNET_USER_ID;
  const MASNET_TOKEN = process.env.MASNET_TOKEN;
  const MASNET_URL = process.env.MASNET_URL; // ej: https://masnet.com.ar/api/v1/productos

  if (!MASNET_USER_ID || !MASNET_TOKEN || !MASNET_URL) {
    console.warn("❌ Masnet → Faltan MASNET_USER_ID, MASNET_TOKEN o MASNET_URL");
    return null;
  }

  return {
    user_id: String(MASNET_USER_ID).trim(),
    token: String(MASNET_TOKEN).trim(),
    url: String(MASNET_URL).trim(),
  };
}

function normalizeText(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // sin acentos
    .replace(/\s+/g, " ");
}

function matchAllWords(hay, query) {
  const h = normalizeText(hay);
  const terms = normalizeText(query).split(" ").filter(Boolean);
  return terms.every((t) => h.includes(t));
}

// ----------------------------
// Cache SKU (local + redis)
// ----------------------------
const MASNET_SKU_LOCAL_TTL_MS = 5 * 60 * 1000; // 5 min
const MASNET_SKU_REDIS_TTL_S = 10 * 60; // 10 min (redis en segundos)

const skuLocalCache = new Map(); // key -> { ts, value }

function skuLocalGetEntry(key) {
  const entry = skuLocalCache.get(key);
  if (!entry) return { hit: false, value: null };

  if (Date.now() - entry.ts > MASNET_SKU_LOCAL_TTL_MS) {
    skuLocalCache.delete(key);
    return { hit: false, value: null };
  }

  return { hit: true, value: entry.value };
}

function skuLocalSet(key, value) {
  skuLocalCache.set(key, { ts: Date.now(), value });
}

/**
 * Returns true when the relevant local cache is populated for this query.
 * - SKU queries → skuLocalCache
 * - Name queries → CSV MEM catalog
 */
export function isMasnetCacheWarm(query = "") {
  const trimmed = String(query || "").trim();
  if (isSku(trimmed)) {
    return skuLocalGetEntry(`masnet:sku:list:${trimmed.toUpperCase()}`).hit;
  }
  return isMasnetCatalogWarm();
}

/**
 * 1 request a Masnet (JSON API)
 * - BODY: credenciales
 * - QUERYSTRING: limit/offset/codigo_producto/actualizacion
 *
 * ⚠️ OJO: en doc no figura "nombre", así que NO lo usamos para búsquedas por nombre.
 */
async function fetchMasnetOnce({ creds, paramsObj, timeout = 5000 }) {
  const body = { user_id: creds.user_id, token: creds.token };

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(paramsObj || {})) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }

  const url = `${creds.url}?${params.toString()}`;

  const res = await axios.post(url, body, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    timeout,
  });

  const items = Array.isArray(res.data?.resultado) ? res.data.resultado : [];
  const pag = res.data?.paginador || null;

  return { items, pag, url, raw: res.data };
}

/**
 * 🔵 Búsqueda en Masnet (POST)
 * - SKU => ✅ cache local + Redis + request real
 * - Nombre => ✅ CSV + cache (sin sesgo, 1 request por TTL)
 */
export async function fetchProductsFromMasnet(
  query = "",
  { limit = 100, offset = 0 } = {}
) {
  const creds = getCreds();
  if (!creds) return [];

  const trimmed = String(query || "").trim();
  if (!trimmed) return [];

  // ----------------------------
  // ✅ Caso SKU => cache local + redis
  // ----------------------------
  if (isSku(trimmed)) {
    const skuKey = trimmed.trim().toUpperCase();
    const cacheKey = `masnet:sku:list:${skuKey}`;

    // 1) local cache (acepta [] / null)
    const { hit: localHit, value: localValue } = skuLocalGetEntry(cacheKey);
    if (localHit) {
      console.log(
        `🟦 [Masnet SKU local HIT] ${skuKey} → ${
          Array.isArray(localValue) ? localValue.length : 0
        }`
      );
      return localValue;
    }

    // 2) redis cache (acepta [] / null)
    const redisHit = await cacheGet(cacheKey);
    if (redisHit !== null && redisHit !== undefined) {
      console.log(
        `🟦 [Masnet SKU redis HIT] ${skuKey} → ${
          Array.isArray(redisHit) ? redisHit.length : 0
        }`
      );
      skuLocalSet(cacheKey, redisHit);
      return redisHit;
    }

    // 3) request real
    const { items, url } = await fetchMasnetOnce({
      creds,
      paramsObj: { limit, offset, codigo_producto: trimmed },
    });

    console.log("🔵 [Masnet SKU MISS] URL:", url, "→", items.length);

    // cachear (incluso si viene vacío)
    skuLocalSet(cacheKey, items);
    await cacheSet(cacheKey, items, MASNET_SKU_REDIS_TTL_S);

    return items;
  }

  // ----------------------------
  // ✅ Caso Nombre => CSV + cache
  // ----------------------------
  if (trimmed.length < 3) return [];

  let catalog = [];
  try {
    catalog = await getMasnetCatalogCached(); // 👈 trae/cacha CSV (no rate limit por paginado)
  } catch (err) {
    console.error("❌ [Masnet CSV cache] Error:", err?.message || err);
    return [];
  }

  const filtered = catalog.filter((p) => {
    const hay = `${p.nombre ?? ""} ${p.marca ?? ""} ${p.codigo_producto ?? ""} ${
      p.codigo_alfa ?? ""
    }`;
    return matchAllWords(hay, trimmed);
  });

  console.log(
    `🟠 [Masnet nombre CSV] "${trimmed}" → ${filtered.length} (catálogo ${catalog.length})`
  );

  return filtered;
}

/**
 * 🔍 Búsqueda exacta por SKU
 * - cache local + redis
 * - luego lookups directos
 * - luego scan paginado (fallback)
 */
function normUpper(s) {
  return String(s ?? "").trim().toUpperCase();
}

export async function fetchProductBySkuFromMasnet(
  sku,
  { limit = 100, maxPages = 30, timeout = 5000 } = {}
) {
  const creds = getCreds();
  if (!creds) return null;

  const target = normUpper(sku);
  if (!target) return null;

  const cacheKey = `masnet:sku:exact:${target}`;

  // 1) local cache (acepta null)
  const { hit: localHit, value: localValue } = skuLocalGetEntry(cacheKey);
  if (localHit) {
    console.log(`🟦 [Masnet exact local HIT] ${target}`);
    return localValue;
  }

  // 2) redis cache (acepta null)
  const redisHit = await cacheGet(cacheKey);
  if (redisHit !== null && redisHit !== undefined) {
    console.log(`🟦 [Masnet exact redis HIT] ${target}`);
    skuLocalSet(cacheKey, redisHit);
    return redisHit;
  }

  // 3) lookups directos (offset 0)
  for (const key of ["codigo_producto", "codigo_alfa", "id"]) {
    try {
      const { items, url } = await fetchMasnetOnce({
        creds,
        paramsObj: { limit, offset: 0, [key]: String(sku).trim() },
        timeout,
      });

      console.log(`🔎 [Masnet exact] ${key} →`, url, "items:", items.length);

      const found = items.find((p) => {
        return (
          normUpper(p.codigo_producto) === target ||
          normUpper(p.codigo_alfa) === target ||
          normUpper(p.id) === target
        );
      });

      if (found) {
        skuLocalSet(cacheKey, found);
        await cacheSet(cacheKey, found, MASNET_SKU_REDIS_TTL_S);
        return found;
      }
    } catch (err) {
      console.error(
        `❌ Masnet exact (${key}):`,
        err.response?.data || err.message
      );
    }
  }

  // 4) fallback: scan catálogo paginado sin filtros
  console.warn(
    "⚠️ [Masnet exact] No apareció por filtros. Escaneando catálogo paginado..."
  );

  let offset = 0;

  for (let page = 1; page <= maxPages; page++) {
    const { items } = await fetchMasnetOnce({
      creds,
      paramsObj: { limit, offset },
      timeout,
    });

    if (!items.length) break;

    const found = items.find((p) => {
      return (
        normUpper(p.codigo_producto) === target ||
        normUpper(p.codigo_alfa) === target ||
        normUpper(p.id) === target
      );
    });

    if (found) {
      skuLocalSet(cacheKey, found);
      await cacheSet(cacheKey, found, MASNET_SKU_REDIS_TTL_S);
      return found;
    }

    if (items.length < limit) break;
    offset += limit;
  }

  console.warn("⚠️ [Masnet] SKU no encontrado:", target);

  // cachear not-found corto
  const notFound = null;
  skuLocalSet(cacheKey, notFound);
  await cacheSet(cacheKey, notFound, 2 * 60); // 2 min
  return null;
}