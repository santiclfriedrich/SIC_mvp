// web/src/lib/services/airintraAPI.js
//
// Estrategia: catálogo completo via POST paginado (page=0,1,2…), token Bearer.
// Auth: GET /v2/?q=login&user=&pass= → token
// Catalog: POST /v2/?q=articulos&page=N → array de productos, [] = fin
// Sin rate limit conocido → requests secuenciales sin delay.

import axios from "axios";
import { cacheGet as redisCacheGet, cacheSet as redisCacheSet } from "@/lib/cache/redisCache";

const BASE_URL = "https://api.air-intra.com/v2";

// ── Cache keys & TTLs ────────────────────────────────────────────────────────
const CATALOG_REDIS_KEY = "airintra:catalog:v1";
const CATALOG_LOCAL_TTL = 30 * 60 * 1000;  // 30 min en memoria
const CATALOG_REDIS_TTL = 24 * 60 * 60;    // 24h en Redis (segundos)
const TOKEN_TTL_MS      = 12 * 60 * 60 * 1000; // 12h token en memoria
const MAX_PAGES         = 200;  // techo de seguridad
const MAX_RETRIES       = 3;    // reintentos por error de red

// ── In-memory state ───────────────────────────────────────────────────────────
let catalogCache    = { ts: 0, items: [] };
let tokenCache      = { ts: 0, token: null };
let downloadPromise = null;

// ── Credentials ───────────────────────────────────────────────────────────────
function getCreds() {
  const username = process.env.AIR_INTRA_USERNAME;
  const password = process.env.AIR_INTRA_PASSWORD;

  if (!username || !password) {
    console.warn("❌ [AirIntra] Faltan AIR_INTRA_USERNAME o AIR_INTRA_PASSWORD");
    return null;
  }

  return { username: String(username).trim(), password: String(password).trim() };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function normalizeText(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

// ── Token (GET login, cache en memoria 1h) ────────────────────────────────────
// El token de AirIntra expira cada ~24h. Siempre obtenemos uno fresco via login.
async function getAirIntraToken() {
  const now = Date.now();

  // Cache en memoria
  if (tokenCache.token && now - tokenCache.ts < TOKEN_TTL_MS) {
    return tokenCache.token;
  }

  const creds = getCreds();
  if (!creds) return null;

  console.log("🔵 [AirIntra] Obteniendo token via login...");

  const res = await axios.get(`${BASE_URL}/login`, {
    params: { user: creds.username, pass: creds.password },
    timeout: 15000,
  });

  const token = res.data?.token ?? null;
  if (!token) {
    throw new Error("AirIntra auth: token no encontrado en la respuesta");
  }

  tokenCache = { ts: now, token };
  console.log("✅ [AirIntra] Token obtenido");
  return token;
}

// ── Single page fetch (POST con retry en errores de red) ──────────────────────
async function fetchAirIntraPage(token, page, attempt = 1) {
  try {
    const res = await axios.post(
      `${BASE_URL}/articulos?page=${page}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 45000,
        validateStatus: (s) => s < 500,
        transformResponse: [(raw) => {
          // La API puede incluir PHP notices antes del JSON — los descartamos
          try {
            const jsonStart = raw.indexOf("[");
            if (jsonStart > 0) return JSON.parse(raw.slice(jsonStart));
            return JSON.parse(raw);
          } catch {
            return [];
          }
        }],
      }
    );

    if (res.status === 401 || res.status === 403) {
      // Token expirado — limpiar cache para que se renueve
      tokenCache = { ts: 0, token: null };
      throw new Error(`AirIntra auth expirado (HTTP ${res.status}) en página ${page}`);
    }

    if (res.status !== 200) {
      throw new Error(`AirIntra HTTP ${res.status} en página ${page}`);
    }

    // Respuesta puede ser array (ok) u objeto con error
    const data = res.data;
    if (data?.error_id) {
      throw new Error(`AirIntra error ${data.error_id}: ${data.error_name} — ${data.error_detail}`);
    }

    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (attempt <= MAX_RETRIES && !err.message?.includes("AirIntra")) {
      const wait = 2000 * attempt;
      console.warn(`⚠️ [AirIntra] Error red página ${page} — intento ${attempt}/${MAX_RETRIES}, esperando ${wait}ms`);
      await sleep(wait);
      return fetchAirIntraPage(token, page, attempt + 1);
    }
    throw err;
  }
}

// ── Full catalog download ─────────────────────────────────────────────────────
async function fetchAirIntraCatalogAll(token) {
  const all = [];
  let page  = 0;

  while (page < MAX_PAGES) {
    console.log(`🔵 [AirIntra] Página ${page}`);

    const items = await fetchAirIntraPage(token, page);

    if (!items.length) {
      console.log(`🔵 [AirIntra] Fin del catálogo en página ${page}`);
      break;
    }

    all.push(...items);
    page++;
  }

  if (all.length > 0) {
    console.log("🔵 [AirIntra] primer producto (debug):", JSON.stringify(all[0]).slice(0, 300));
  }

  console.log(`✅ [AirIntra] catálogo descargado: ${all.length} productos`);
  return all;
}

// ── Filtrar sin stock ─────────────────────────────────────────────────────────
function calcStock(p) {
  return p.air?.disponible ?? 0; // "General" = stock real
}

// ── Sync bloqueante para cron ─────────────────────────────────────────────────
export async function syncAirIntraCatalogToRedis() {
  const token = await getAirIntraToken();
  if (!token) throw new Error("No se pudo obtener token de AirIntra");

  const rawItems = await fetchAirIntraCatalogAll(token);
  if (!rawItems.length) throw new Error("Catálogo vacío — verificar credenciales AirIntra");

  const items = rawItems.filter((p) => calcStock(p) > 0);
  console.log(`🔵 [AirIntra sync] con stock: ${items.length}/${rawItems.length}`);

  await redisCacheSet(CATALOG_REDIS_KEY, items, CATALOG_REDIS_TTL);
  catalogCache = { ts: Date.now(), items };

  console.log(`✅ [AirIntra sync] catálogo en Redis: ${items.length} productos`);
  return { ok: true, total: rawItems.length, withStock: items.length };
}

// ── Catalog cache (memory → Redis → API, singleton download) ─────────────────
async function getAirIntraCatalogCached() {
  const now = Date.now();

  // 1) memoria
  if (catalogCache.items.length && now - catalogCache.ts < CATALOG_LOCAL_TTL) {
    console.log(`🟦 [AirIntra local HIT] ${catalogCache.items.length} productos`);
    return catalogCache.items;
  }

  // 2) Redis
  const redisHit = await redisCacheGet(CATALOG_REDIS_KEY);
  if (redisHit && Array.isArray(redisHit) && redisHit.length) {
    console.log(`🟦 [AirIntra redis HIT] ${redisHit.length} productos`);
    catalogCache = { ts: now, items: redisHit };
    return redisHit;
  }

  // 3) descarga singleton (fire-and-forget)
  if (downloadPromise) {
    console.log("🔵 [AirIntra] descarga en curso, devolviendo [] por ahora");
    return [];
  }

  const token = await getAirIntraToken();
  if (!token) return [];

  console.log("🔵 [AirIntra MISS] iniciando descarga en background…");

  downloadPromise = fetchAirIntraCatalogAll(token)
    .then(async (rawItems) => {
      if (!rawItems.length) {
        console.warn("⚠️ [AirIntra] catálogo vacío");
        return [];
      }

      const items = rawItems.filter((p) => calcStock(p) > 0);
      console.log(`🔵 [AirIntra] con stock: ${items.length}/${rawItems.length}`);

      catalogCache = { ts: Date.now(), items };

      try {
        await redisCacheSet(CATALOG_REDIS_KEY, items, CATALOG_REDIS_TTL);
        console.log(`✅ [AirIntra] catálogo en Redis: ${items.length} productos`);
      } catch (redisErr) {
        console.error("❌ [AirIntra] error Redis:", redisErr.message);
      }

      return items;
    })
    .catch((err) => {
      console.error("❌ [AirIntra] error en descarga background:", err.message);
      return [];
    })
    .finally(() => {
      downloadPromise = null;
    });

  return [];
}

// ── Warm check ────────────────────────────────────────────────────────────────
export function isAirIntraCacheWarm() {
  if (downloadPromise !== null) return true;
  return catalogCache.items.length > 0 && Date.now() - catalogCache.ts < CATALOG_LOCAL_TTL;
}

// ── Public: búsqueda general ──────────────────────────────────────────────────
export async function fetchProductsFromAirIntra(query = "") {
  try {
    const catalog = await getAirIntraCatalogCached();

    const q = String(query || "").trim();
    if (!q) return catalog;

    if (isSku(q)) {
      const qNorm = normSku(q);
      const results = catalog.filter((p) => {
        const pn = normSku(p.part_number ?? "");
        const id = normSku(p.codigo ?? "");
        return pn === qNorm || id === qNorm || pn.includes(qNorm);
      });
      console.log(`🔵 [AirIntra SKU] "${q}" → ${results.length}`);
      return results;
    }

    const terms = normalizeText(q).split(" ").filter(Boolean);
    const results = catalog.filter((p) => {
      const hay = normalizeText(`${p.descrip ?? ""} ${p.part_number ?? ""}`);
      return terms.every((t) => hay.includes(t));
    });

    console.log(`🔵 [AirIntra nombre] "${q}" → ${results.length}`);
    return results;
  } catch (err) {
    console.error("❌ [AirIntra] fetchProductsFromAirIntra:", err.message);
    return [];
  }
}

// ── Public: búsqueda exacta por SKU ──────────────────────────────────────────
export async function fetchProductBySkuFromAirIntra(sku) {
  try {
    const catalog = await getAirIntraCatalogCached();

    const target = String(sku || "").trim();
    if (!target) return null;

    const tNorm = normSku(target);

    const found = catalog.find((p) => {
      return normSku(p.part_number ?? "") === tNorm || normSku(p.codigo ?? "") === tNorm;
    });

    console.log(`🔵 [AirIntra SKU exacto] "${target}" → ${found ? "encontrado" : "no encontrado"}`);
    return found ?? null;
  } catch (err) {
    console.error("❌ [AirIntra] fetchProductBySkuFromAirIntra:", err.message);
    return null;
  }
}
