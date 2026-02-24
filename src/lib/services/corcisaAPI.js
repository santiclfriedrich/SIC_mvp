// web/src/lib/services/corcisaAPI.js
import axios from "axios";
import fs from "fs";

const BASE_URL = "https://corcisa.com.ar/api/v1/productos";

/** ===== Cache config (LOCAL) ===== */
const CORCISA_CATALOG_TTL_MS = 30 * 60 * 1000; // 30 min
const CORCISA_CACHE_FILE = "/tmp/corcisa_catalog_cache.json"; // en local también sirve

let CORCISA_CATALOG_CACHE = {
  ts: 0,
  items: [],
};

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
 * ✅ Trae TODAS las páginas de Corcisa (hasta que devuelva < limit)
 * - limit máximo: 100
 * - offset incremental
 * - opcional: actualizacion (YYYY-MM-DD HH:MM)
 */
export async function fetchAllProductsFromCorcisa({
  limit = 100,
  actualizacion = null,
  maxPages = 5000, // guardrail
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

      // mini pausa para no rate-limitear
      if (sleepMs) await sleep(sleepMs);
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      console.error(
        "❌ Corcisa paginación error:",
        status,
        data || err?.message || err
      );

      // Backoff razonable
      if (status === 403 || status === 429) backoff(60 * 60 * 1000); // 1h
      else if (status >= 500) backoff(10 * 60 * 1000); // 10m

      break;
    }
  }

  return all;
}

/**
 * ✅ Catálogo cacheado (LOCAL)
 * - 1) memoria (rápido)
 * - 2) /tmp (persistencia simple)
 * - 3) refresh paginado
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

  // 1) memoria
  if (
    !force &&
    CORCISA_CATALOG_CACHE.items.length &&
    t - CORCISA_CATALOG_CACHE.ts < ttlMs
  ) {
    console.log(
      `🟦 [Corcisa cache HIT mem] catálogo: ${CORCISA_CATALOG_CACHE.items.length}`
    );
    return CORCISA_CATALOG_CACHE.items;
  }

  // 2) archivo /tmp
  if (!force) {
    const file = readCatalogCacheFile();
    if (file?.items?.length && t - file.ts < ttlMs) {
      CORCISA_CATALOG_CACHE = file;
      console.log(
        `🟦 [Corcisa cache HIT file] catálogo: ${file.items.length}`
      );
      return file.items;
    }
  }

  // 3) si estamos bloqueados, devolver lo que haya (aunque esté vencido)
  if (isBlocked()) {
    if (CORCISA_CATALOG_CACHE.items.length) {
      console.warn(
        "🟦 [Corcisa] Backoff activo. Devolviendo catálogo de memoria (stale)."
      );
      return CORCISA_CATALOG_CACHE.items;
    }
    const file = readCatalogCacheFile();
    if (file?.items?.length) {
      console.warn(
        "🟦 [Corcisa] Backoff activo. Devolviendo catálogo de archivo (stale)."
      );
      return file.items;
    }
    console.warn("🟦 [Corcisa] Backoff activo. Sin cache → []");
    return [];
  }

  // 4) refresh real
  console.log("🟦 [Corcisa cache MISS] refrescando catálogo...");
  const items = await fetchAllProductsFromCorcisa({
    limit,
    actualizacion,
    maxPages,
    sleepMs,
  });

  CORCISA_CATALOG_CACHE = { ts: now(), items };
  writeCatalogCacheFile(CORCISA_CATALOG_CACHE.ts, items);

  console.log(`🟦 [Corcisa] catálogo cacheado: ${items.length}`);
  return items;
}

/**
 * 🔵 Búsqueda (compat con tu flujo actual)
 * - SKU: server-side (rápido, 1 request)
 * - Nombre: usa catálogo cacheado y filtra local
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

  // 1) SKU: server-side (rápido)
  if (trimmed && isSku(trimmed)) {
    const params = { limit: 100, offset: 0, codigo_producto: trimmed };
    console.log("🔵 [Corcisa] SKU POST filtros →", {
      limit: params.limit,
      offset: params.offset,
      codigo_producto: params.codigo_producto,
    });

    try {
      const res = await corcisaPost({ params, body });
      const results = Array.isArray(res.data?.resultado) ? res.data.resultado : [];
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

  // 2) Nombre / búsqueda general: catálogo cacheado + filtro local
  const all = await fetchAllProductsFromCorcisaCached({
    limit: 100,
    ttlMs: CORCISA_CATALOG_TTL_MS,
  });

  if (!trimmed) return all;

  const words = trimmed
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

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