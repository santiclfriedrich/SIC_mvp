// web/src/lib/services/elitAPI.js
//
// Estrategia: catálogo completo via POST paginado (memoria + Redis).
// Descarga una vez, búsqueda local en cada query.

import axios from "axios";
import { cacheGet as redisCacheGet, cacheSet as redisCacheSet } from "@/lib/cache/redisCache";

const BASE_URL = "https://clientes.elit.com.ar/v1/api";

const CATALOG_REDIS_KEY = "elit:catalog:v3";
const CATALOG_LOCAL_TTL = 30 * 60 * 1000; // 30 min en memoria
const CATALOG_REDIS_TTL = 30 * 60;         // 30 min en Redis
const PAGE_SIZE         = 100;
const BATCH_SIZE        = 5;               // páginas en paralelo por batch
const MAX_PAGES         = 300;             // techo de seguridad (~30k productos)

// ── In-memory catalog ─────────────────────────────────────────────────────
let catalogCache = { ts: 0, items: [] };

// ── Credentials ──────────────────────────────────────────────────────────
function getCreds() {
  const user_id = process.env.ELIT_USER_ID;
  const token   = process.env.ELIT_TOKEN;

  if (!user_id || !token) {
    console.warn("❌ [Elit] Faltan ELIT_USER_ID o ELIT_TOKEN");
    return null;
  }

  return { user_id: Number(user_id), token: String(token).trim() };
}

// ── Helpers ───────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normSku(s) {
  return String(s || "").trim().toUpperCase().replace(/[\s\-_.]/g, "");
}

function isSku(q = "") {
  const t = String(q).trim();
  return t.length > 0 && !t.includes(" ") && /\d/.test(t);
}

// ── Single page fetch ─────────────────────────────────────────────────────
// Returns:
//   array  → page results
//   null   → 400 on offset > 0 (end of catalog)
//   throws → real error (400 on offset=0, 5xx, network)
async function fetchElitPage(creds, offset) {
  const url = `${BASE_URL}/productos?limit=${PAGE_SIZE}&offset=${offset}`;

  const res = await axios.post(url, creds, {
    headers: { "Content-Type": "application/json" },
    timeout: 12000,
    validateStatus: (s) => s < 500,
  });

  if (res.status === 400) {
    if (offset === 1) {
      // 400 en la primera página = credenciales inválidas u otro error real
      const msg = res.data?.message ?? res.data?.error ?? JSON.stringify(res.data).slice(0, 200);
      throw new Error(`Elit 400 en offset=1: ${msg}`);
    }
    // 400 en páginas siguientes = fin del catálogo
    console.log(`🔵 [Elit] offset=${offset} → 400 (fin de catálogo)`);
    return null;
  }

  if (res.status !== 200) {
    throw new Error(`Elit HTTP ${res.status} en offset=${offset}`);
  }

  const resultado = res.data?.resultado ?? res.data?.data ?? res.data;
  return Array.isArray(resultado) ? resultado : [];
}

// ── Full catalog download ─────────────────────────────────────────────────
async function fetchElitCatalogAll(creds) {
  const all = [];

  // Elit usa offset posicional 1-based: 1, 101, 201, 301...
  for (let batchStart = 0; batchStart < MAX_PAGES; batchStart += BATCH_SIZE) {
    const offsets = [];
    for (let i = 0; i < BATCH_SIZE && batchStart + i < MAX_PAGES; i++) {
      offsets.push((batchStart + i) * PAGE_SIZE + 1);
    }

    console.log(`🔵 [Elit] offsets ${offsets[0]}–${offsets[offsets.length - 1]}`);

    const results = await Promise.allSettled(
      offsets.map((o) => fetchElitPage(creds, o))
    );

    let reachedEnd = false;
    for (const r of results) {
      if (r.status === "rejected") {
        console.error("❌ [Elit] error en página:", r.reason?.message);
        reachedEnd = true;
        break;
      }
      if (r.value === null) { reachedEnd = true; break; }     // fin de catálogo
      all.push(...r.value);
      if (r.value.length < PAGE_SIZE) { reachedEnd = true; break; } // última página
    }

    if (reachedEnd) break;

    await sleep(100); // pausa cortés entre batches
  }

  // Log primer producto para confirmar nombres de campo reales
  if (all.length > 0) {
    console.log("🔵 [Elit] primer producto (campo debug):", JSON.stringify(all[0]).slice(0, 300));
  }

  console.log(`✅ [Elit] catálogo descargado: ${all.length} productos`);
  return all;
}

// ── Catalog cache (memory → Redis → API) ──────────────────────────────────
async function getElitCatalogCached() {
  const now = Date.now();

  // 1) memoria
  if (catalogCache.items.length && now - catalogCache.ts < CATALOG_LOCAL_TTL) {
    console.log(`🟦 [Elit local HIT] ${catalogCache.items.length} productos`);
    return catalogCache.items;
  }

  // 2) Redis
  const redisHit = await redisCacheGet(CATALOG_REDIS_KEY);
  if (redisHit && Array.isArray(redisHit) && redisHit.length) {
    console.log(`🟦 [Elit redis HIT] ${redisHit.length} productos`);
    catalogCache = { ts: now, items: redisHit };
    return redisHit;
  }

  // 3) descarga completa
  const creds = getCreds();
  if (!creds) return [];

  console.log("🔵 [Elit MISS] descargando catálogo completo…");
  const items = await fetchElitCatalogAll(creds);

  if (!items.length) {
    console.warn("⚠️ [Elit] catálogo vacío — verificar credenciales");
    return [];
  }

  catalogCache = { ts: now, items };
  await redisCacheSet(CATALOG_REDIS_KEY, items, CATALOG_REDIS_TTL);
  console.log(`✅ [Elit] cacheado en Redis: ${items.length} productos`);
  return items;
}

// ── Warm check ────────────────────────────────────────────────────────────
export function isElitCacheWarm() {
  return catalogCache.items.length > 0 && Date.now() - catalogCache.ts < CATALOG_LOCAL_TTL;
}

// ── SKU helpers (tolerante a variaciones de nombre de campo) ──────────────
function getProductSku(p) {
  return (
    p.codigo_producto ??
    p.codigo_produto  ??
    p.codigo_alfa     ??
    p.codigo          ??
    p.sku             ??
    ""
  );
}

// ── Public search functions ───────────────────────────────────────────────

export async function fetchProductsFromElit(query = "") {
  try {
    const catalog = await getElitCatalogCached();

    const q = String(query || "").trim();
    if (!q) return catalog;

    if (isSku(q)) {
      const qNorm = normSku(q);
      const results = catalog.filter((p) => {
        const s1 = normSku(getProductSku(p));
        const s2 = normSku(p.codigo_alfa ?? "");
        return s1 === qNorm || s2 === qNorm || s1.includes(qNorm) || s2.includes(qNorm);
      });
      console.log(`🔵 [Elit SKU] "${q}" → ${results.length}`);
      return results;
    }

    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const results = catalog.filter((p) => {
      const hay = `${p.nombre ?? ""} ${p.marca ?? ""} ${p.categoria ?? ""} ${getProductSku(p)}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });

    console.log(`🔵 [Elit nombre] "${q}" → ${results.length}`);
    return results;
  } catch (err) {
    console.error("❌ [Elit] fetchProductsFromElit:", err.message);
    return [];
  }
}

export async function fetchProductBySkuFromElit(sku) {
  try {
    const catalog = await getElitCatalogCached();

    const target = String(sku || "").trim();
    if (!target) return null;

    const tNorm = normSku(target);

    const found = catalog.find((p) => {
      const s1 = normSku(getProductSku(p));
      const s2 = normSku(p.codigo_alfa ?? "");
      return s1 === tNorm || s2 === tNorm;
    });

    console.log(`🔵 [Elit SKU exacto] "${target}" → ${found ? "encontrado" : "no encontrado"}`);
    return found ?? null;
  } catch (err) {
    console.error("❌ [Elit] fetchProductBySkuFromElit:", err.message);
    return null;
  }
}
