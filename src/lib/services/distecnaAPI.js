// web/src/lib/services/distecnaAPI.js
//
// Estrategia: catálogo completo via GET paginado (offset), x-apikey header.
// Auth: x-apikey header directo — sin login previo ni token.
// Catalog: GET /Product?offset=N → { total, offset, products: [] }
// Paginación: se incrementa offset por la cantidad de productos recibidos
//             hasta cubrir el total reportado por la API.
// Detail: GET /Product/{code} — incluye name, brand, images, etc.
//         Solo se usa en búsqueda por SKU exacto para enriquecer el resultado.

import axios from "axios";
import https from "https";
import { cacheGet as redisCacheGet, cacheSet as redisCacheSet } from "@/lib/cache/redisCache";

// Distecna usa certificado con cadena incompleta — desactivamos verificación TLS.
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const BASE_URL = process.env.DISTECNA_URL ?? "https://api.distecna.com:8096";

// ── Cache keys & TTLs ────────────────────────────────────────────────────────
const CATALOG_REDIS_KEY = "distecna:catalog:v1";
const CATALOG_LOCAL_TTL = 30 * 60 * 1000;  // 30 min en memoria
const CATALOG_REDIS_TTL = 6 * 60 * 60;     // 6h en Redis

// ── In-memory state ───────────────────────────────────────────────────────────
let catalogCache    = { ts: 0, items: [] };
let downloadPromise = null;

// ── Credentials ───────────────────────────────────────────────────────────────
function getApiKey() {
  const key = process.env.DISTECNA_API_KEY;
  if (!key) {
    console.warn("❌ [Distecna] Falta DISTECNA_API_KEY");
    return null;
  }
  return String(key).trim();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function normSku(s) {
  return String(s || "").trim().toUpperCase().replace(/[\s\-_.]/g, "");
}

function isSku(q = "") {
  const t = String(q).trim();
  return t.length > 0 && !t.includes(" ") && /\d/.test(t);
}

function normalizeText(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

// ── Single page fetch ─────────────────────────────────────────────────────────
async function fetchDistecnaPage(apiKey, offset = 0) {
  const res = await axios.get(`${BASE_URL}/Product`, {
    headers:    { "x-apikey": apiKey },
    params:     { offset },
    timeout:    30000,
    httpsAgent,
  });

  const data = res.data;

  // La respuesta puede ser el array directamente o un objeto con total/offset/products
  if (Array.isArray(data)) {
    return { total: data.length, products: data };
  }

  return {
    total:    data?.total    ?? 0,
    products: Array.isArray(data?.products) ? data.products : [],
  };
}

// ── Full catalog download (paginado) ──────────────────────────────────────────
async function fetchDistecnaCatalogRaw() {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  console.log("🔵 [Distecna] Descargando catálogo completo...");

  // Primera página — establece el total
  const first = await fetchDistecnaPage(apiKey, 0);

  if (!first.products.length) {
    console.warn("⚠️ [Distecna] La primera página está vacía");
    return [];
  }

  console.log("🔵 [Distecna] primer producto (debug):", JSON.stringify(first.products[0]).slice(0, 300));
  console.log(`🔵 [Distecna] total reportado: ${first.total} | primera página: ${first.products.length} productos`);

  const all = [...first.products];

  // Si ya tenemos todo o la API no pagina, salimos
  if (!first.total || all.length >= first.total) {
    console.log(`✅ [Distecna] catálogo completo en una página: ${all.length} productos`);
    return all;
  }

  // Paginar mientras queden productos
  const MAX_PAGES = 100; // techo de seguridad
  let   page      = 1;

  while (all.length < first.total && page < MAX_PAGES) {
    const offset = all.length;
    console.log(`🔵 [Distecna] Página ${page} (offset=${offset})...`);

    const chunk = await fetchDistecnaPage(apiKey, offset);

    if (!chunk.products.length) {
      console.log(`🔵 [Distecna] Fin del catálogo en offset ${offset}`);
      break;
    }

    all.push(...chunk.products);
    page++;
  }

  console.log(`✅ [Distecna] catálogo descargado: ${all.length} productos`);
  return all;
}

// ── Catalog cache (memory → Redis → API, fire-and-forget) ────────────────────
async function getDistecnaCatalogCached() {
  const now = Date.now();

  // 1) memoria
  if (catalogCache.items.length && now - catalogCache.ts < CATALOG_LOCAL_TTL) {
    console.log(`🟦 [Distecna local HIT] ${catalogCache.items.length} productos`);
    return catalogCache.items;
  }

  // 2) Redis
  const redisHit = await redisCacheGet(CATALOG_REDIS_KEY);
  if (redisHit && Array.isArray(redisHit) && redisHit.length) {
    console.log(`🟦 [Distecna redis HIT] ${redisHit.length} productos`);
    catalogCache = { ts: now, items: redisHit };
    return redisHit;
  }

  // 3) descarga — singleton + fire-and-forget
  if (downloadPromise) {
    console.log("🔵 [Distecna] descarga en curso (background), devolviendo []");
    return [];
  }

  console.log("🔵 [Distecna MISS] iniciando descarga en background…");

  downloadPromise = fetchDistecnaCatalogRaw()
    .then(async (items) => {
      if (!items.length) {
        console.warn("⚠️ [Distecna] catálogo vacío");
        return [];
      }

      // Filtrar sin stock
      const withStock = items.filter((p) => Number(p.stock) > 0);
      console.log(`🔵 [Distecna] con stock: ${withStock.length}/${items.length} productos`);

      catalogCache = { ts: Date.now(), items: withStock };
      await redisCacheSet(CATALOG_REDIS_KEY, withStock, CATALOG_REDIS_TTL);
      console.log(`✅ [Distecna] catálogo en Redis: ${withStock.length} productos`);
      return withStock;
    })
    .catch((err) => {
      console.error("❌ [Distecna] error en descarga background:", err.message);
      return [];
    })
    .finally(() => {
      downloadPromise = null;
    });

  return [];
}

// ── Detail fetch (enriquece con name, brand, images) ─────────────────────────
async function fetchDistecnaDetail(apiKey, code) {
  try {
    const res = await axios.get(`${BASE_URL}/Product/${encodeURIComponent(code)}`, {
      headers:    { "x-apikey": apiKey },
      timeout:    10000,
      httpsAgent,
    });
    return res.data ?? null;
  } catch (err) {
    console.warn(`⚠️ [Distecna] No se pudo obtener detalle de ${code}:`, err.message);
    return null;
  }
}

// ── Warm check ────────────────────────────────────────────────────────────────
export function isDistecnaCacheWarm() {
  if (downloadPromise !== null) return true;
  return catalogCache.items.length > 0 && Date.now() - catalogCache.ts < CATALOG_LOCAL_TTL;
}

// ── Public: búsqueda general ──────────────────────────────────────────────────
export async function fetchProductsFromDistecna(query = "") {
  try {
    const catalog = await getDistecnaCatalogCached();

    const q = String(query || "").trim();
    if (!q) return catalog;

    if (isSku(q)) {
      const qNorm = normSku(q);
      const results = catalog.filter((p) => {
        const code = normSku(p.code ?? "");
        const sku  = normSku(p.sku  ?? "");
        return code === qNorm || code.includes(qNorm) || sku === qNorm || sku.includes(qNorm);
      });
      console.log(`🔵 [Distecna código] "${q}" → ${results.length}`);
      return results;
    }

    // El catálogo básico no incluye nombre/marca — búsqueda por código/sku.
    const terms = normalizeText(q).split(" ").filter(Boolean);
    const results = catalog.filter((p) => {
      const hay = normalizeText(
        `${p.name ?? ""} ${p.brand ?? ""} ${p.category ?? ""} ${p.description ?? ""} ${p.code ?? ""} ${p.sku ?? ""}`
      );
      return terms.every((t) => hay.includes(t));
    });

    console.log(`🔵 [Distecna nombre] "${q}" → ${results.length}`);
    return results;
  } catch (err) {
    console.error("❌ [Distecna] fetchProductsFromDistecna:", err.message);
    return [];
  }
}

// ── Public: búsqueda exacta por SKU (con detalle enriquecido) ─────────────────
export async function fetchProductBySkuFromDistecna(sku) {
  try {
    const catalog = await getDistecnaCatalogCached();

    const target = String(sku || "").trim();
    if (!target) return null;

    const tNorm = normSku(target);

    // Buscar en catálogo por code (identificador principal) o sku
    const found = catalog.find((p) => {
      return (
        normSku(p.code ?? "") === tNorm ||
        normSku(p.sku  ?? "") === tNorm
      );
    });

    if (!found) {
      console.log(`🔵 [Distecna código exacto] "${target}" → no encontrado`);
      return null;
    }

    // Enriquecer con detalle si el catálogo no tiene nombre
    if (!found.name) {
      const apiKey = getApiKey();
      if (apiKey) {
        const detail = await fetchDistecnaDetail(apiKey, found.code ?? found.sku);
        if (detail) {
          console.log(`🔵 [Distecna código exacto] "${target}" → encontrado (con detalle)`);
          return { ...found, ...detail };
        }
      }
    }

    console.log(`🔵 [Distecna código exacto] "${target}" → encontrado`);
    return found;
  } catch (err) {
    console.error("❌ [Distecna] fetchProductBySkuFromDistecna:", err.message);
    return null;
  }
}

// ── Sync bloqueante para cron ─────────────────────────────────────────────────
export async function syncDistecnaCatalogToRedis() {
  const items = await fetchDistecnaCatalogRaw();

  if (!items.length) {
    return { ok: false, error: "Catálogo vacío", total: 0, withStock: 0 };
  }

  const withStock = items.filter((p) => Number(p.stock) > 0);

  catalogCache = { ts: Date.now(), items: withStock };
  await redisCacheSet(CATALOG_REDIS_KEY, withStock, CATALOG_REDIS_TTL);

  console.log(`✅ [Distecna sync] total: ${items.length} | con stock: ${withStock.length}`);
  return { ok: true, total: items.length, withStock: withStock.length };
}
