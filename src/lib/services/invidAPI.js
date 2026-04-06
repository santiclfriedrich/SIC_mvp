// web/src/lib/services/invidAPI.js
//
// Estrategia: catálogo completo via GET paginado secuencial, token JWT (6h).
// Auth: POST /api/v1/auth.php → access_token
// Catalog: GET /api/v1/articulo.php?offset=N siguiendo next_page_url
// La API tiene rate limit estricto → requests secuenciales + retry con backoff en 429.
// Download singleton: solo una descarga activa a la vez.

import axios from "axios";
import { cacheGet as redisCacheGet, cacheSet as redisCacheSet } from "@/lib/cache/redisCache";

const BASE_URL = "https://www.invidcomputers.com";

// ── Cache keys & TTLs ────────────────────────────────────────────────────────
const CATALOG_REDIS_KEY = "invid:catalog:v3"; // bump version al cambiar lógica
const CATALOG_LOCAL_TTL = 30 * 60 * 1000;     // 30 min en memoria
const CATALOG_REDIS_TTL = 24 * 60 * 60;       // 24h en Redis (segundos)

const TOKEN_TTL_MS      = 5.5 * 60 * 60 * 1000; // 5.5h (token válido 6h)
const PAGE_SIZE         = 100;   // ítems por página (fijo por la API)
const MAX_PAGES         = 80;    // techo de seguridad (~8000 productos)
const PAGE_DELAY_MS     = 500;   // pausa entre requests para respetar rate limit
const RETRY_429_MS      = 3000;  // espera inicial al recibir 429
const MAX_RETRIES       = 2;     // reintentos máximos por página en 429
const FAILURE_COOLDOWN  = 5 * 60 * 1000; // 5 min sin reintentar tras falla 429

// ── In-memory state ───────────────────────────────────────────────────────────
let catalogCache    = { ts: 0, items: [] };
let tokenCache      = { ts: 0, token: null };
let downloadPromise = null; // singleton: evita descargas simultáneas
let lastFailedTs    = 0;    // timestamp del último fallo 429 (cooldown)

// ── Credentials ───────────────────────────────────────────────────────────────
function getCreds() {
  const username = process.env.INVID_USERNAME;
  const password = process.env.INVID_PASSWORD;

  if (!username || !password) {
    console.warn("❌ [Invid] Faltan INVID_USERNAME o INVID_PASSWORD");
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

// ── JWT Token (memory cache, válido 6h) ───────────────────────────────────────
async function getInvidToken() {
  const now = Date.now();

  if (tokenCache.token && now - tokenCache.ts < TOKEN_TTL_MS) {
    return tokenCache.token;
  }

  const creds = getCreds();
  if (!creds) return null;

  console.log("🔵 [Invid] Obteniendo JWT token...");

  const res = await axios.post(
    `${BASE_URL}/api/v1/auth.php`,
    { username: creds.username, password: creds.password },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );

  const token = res.data?.access_token ?? null;
  if (!token) {
    throw new Error("Invid auth: access_token no encontrado en la respuesta");
  }

  tokenCache = { ts: now, token };
  console.log("✅ [Invid] Token JWT obtenido");
  return token;
}

// ── Single page fetch con retry en 429 ───────────────────────────────────────
async function fetchInvidPage(token, offsetOrUrl, attempt = 1) {
  const url =
    typeof offsetOrUrl === "string" && offsetOrUrl.startsWith("http")
      ? offsetOrUrl
      : `${BASE_URL}/api/v1/articulo.php?offset=${offsetOrUrl ?? 0}`;

  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
    validateStatus: (s) => s < 500,
  });

  if (res.status === 429) {
    if (attempt <= MAX_RETRIES) {
      const wait = RETRY_429_MS * attempt; // backoff: 5s, 10s, 15s
      console.warn(`⚠️ [Invid] 429 en ${url} — intento ${attempt}/${MAX_RETRIES}, esperando ${wait}ms`);
      await sleep(wait);
      return fetchInvidPage(token, offsetOrUrl, attempt + 1);
    }
    throw new Error(`Invid rate limit (429) persistente en ${url} tras ${MAX_RETRIES} reintentos`);
  }

  if (res.status !== 200) {
    throw new Error(`Invid HTTP ${res.status} en ${url}`);
  }

  const data    = res.data?.data ?? [];
  const nextUrl = res.data?.next_page_url ?? null;
  return { items: Array.isArray(data) ? data : [], nextUrl };
}

// ── Full catalog download (secuencial con delay) ──────────────────────────────
async function fetchInvidCatalogAll(token) {
  const all = [];
  let nextUrl = null;
  let offset  = 0;
  let page    = 0;

  do {
    page++;
    const target = nextUrl ?? offset;
    console.log(`🔵 [Invid] Página ${page} — offset ${offset}`);

    const { items, nextUrl: next } = await fetchInvidPage(token, target);

    if (!items.length) break;            // página vacía = fin del catálogo
    all.push(...items);
    nextUrl = next ?? null;
    offset += PAGE_SIZE;

    if (items.length < PAGE_SIZE) break; // última página incompleta

    await sleep(PAGE_DELAY_MS);          // respetar rate limit
  } while (page < MAX_PAGES);

  if (all.length > 0) {
    console.log("🔵 [Invid] primer producto (debug):", JSON.stringify(all[0]).slice(0, 300));
  }

  console.log(`✅ [Invid] catálogo descargado: ${all.length} productos`);
  return all;
}

// ── Catalog cache (memory → Redis → API, singleton download) ─────────────────
async function getInvidCatalogCached() {
  const now = Date.now();

  // 1) memoria
  if (catalogCache.items.length && now - catalogCache.ts < CATALOG_LOCAL_TTL) {
    console.log(`🟦 [Invid local HIT] ${catalogCache.items.length} productos`);
    return catalogCache.items;
  }

  // 2) Redis (datos stripeados — sin DESCRIPTION/TAGS, pero válidos para búsqueda y modelo)
  const redisHit = await redisCacheGet(CATALOG_REDIS_KEY);
  if (redisHit && Array.isArray(redisHit) && redisHit.length) {
    console.log(`🟦 [Invid redis HIT] ${redisHit.length} productos`);
    catalogCache = { ts: now, items: redisHit };
    return redisHit;
  }

  // 3) cooldown por 429 reciente — no reintentar hasta que pase el cooldown
  if (lastFailedTs && now - lastFailedTs < FAILURE_COOLDOWN) {
    const waitSec = Math.ceil((FAILURE_COOLDOWN - (now - lastFailedTs)) / 1000);
    console.warn(`⏳ [Invid] cooldown activo por rate limit — próximo intento en ${waitSec}s`);
    return [];
  }

  // 4) descarga — singleton: si ya hay una en curso, devolver [] inmediatamente
  if (downloadPromise) {
    console.log("🔵 [Invid] descarga en curso (background), devolviendo [] por ahora");
    return [];
  }

  const token = await getInvidToken();
  if (!token) return [];

  console.log("🔵 [Invid MISS] iniciando descarga en background…");

  // Fire-and-forget: no bloqueamos la request. La descarga corre en background
  // y llena el cache para las próximas búsquedas.
  downloadPromise = fetchInvidCatalogAll(token)
    .then(async (rawItems) => {
      if (!rawItems.length) {
        console.warn("⚠️ [Invid] catálogo vacío — verificar credenciales");
        return [];
      }

      // Filtrar sin stock antes de cachear — reduce payload y búsquedas más relevantes
      const items = rawItems.filter((p) => {
        const s = String(p.STOCK_STATUS ?? "").toLowerCase();
        return !s.includes("sin stock") && !s.includes("agotado") && s !== "0" && s !== "";
      });
      console.log(`🔵 [Invid] con stock: ${items.length}/${rawItems.length} productos`);

      catalogCache = { ts: Date.now(), items };

      // Strippear campos grandes antes de Redis para no superar el límite de 1MB de Upstash.
      // DESCRIPTION y TAGS pueden ser cientos de chars por producto (5856 prods × ~1KB = ~5MB).
      // Mantenemos solo los campos que usa el modelo y la búsqueda.
      const forRedis = items.map(({ DESCRIPTION, TAGS, IVA_VALUE,
        INTERNAL_TAX_PERCENT, INTERNAL_TAX_VALUE, WEIGHT, DIMENSIONS, ...keep }) => keep);

      try {
        await redisCacheSet(CATALOG_REDIS_KEY, forRedis, CATALOG_REDIS_TTL);
        console.log(`✅ [Invid] catálogo listo en Redis: ${items.length} productos`);
      } catch (redisErr) {
        // Redis falló (ej: payload demasiado grande) pero el catálogo sigue en memoria
        console.error("❌ [Invid] error al guardar en Redis (catálogo queda en memoria):", redisErr.message);
      }

      return items;
    })
    .catch((err) => {
      // Solo activar cooldown si el error es del API de Invid (no de Redis)
      if (err.message?.includes("429") && err.message?.includes("invidcomputers")) {
        lastFailedTs = Date.now();
        console.warn(`⏳ [Invid] rate limit API — cooldown de ${FAILURE_COOLDOWN / 60000} min activado`);
      } else {
        console.error("❌ [Invid] error en descarga background:", err.message);
      }
      return [];
    })
    .finally(() => {
      downloadPromise = null;
    });

  // No await — devolvemos [] de inmediato mientras descarga en background
  return [];
}

// ── Warm check ────────────────────────────────────────────────────────────────
// Devuelve true también durante la descarga background para que el controller
// use el timeout corto (2.5s) en lugar del de 45s — la función retorna [] casi
// de inmediato mientras la descarga corre en background.
export function isInvidCacheWarm() {
  if (downloadPromise !== null) return true;
  return catalogCache.items.length > 0 && Date.now() - catalogCache.ts < CATALOG_LOCAL_TTL;
}

// ── Public: búsqueda general ──────────────────────────────────────────────────
export async function fetchProductsFromInvid(query = "") {
  try {
    const catalog = await getInvidCatalogCached();

    const q = String(query || "").trim();
    if (!q) return catalog;

    if (isSku(q)) {
      const qNorm = normSku(q);
      const results = catalog.filter((p) => {
        const pn = normSku(p.PART_NUMBER ?? "");
        const id = normSku(p.ID ?? "");
        return pn === qNorm || id === qNorm || pn.includes(qNorm);
      });
      console.log(`🔵 [Invid SKU] "${q}" → ${results.length}`);
      return results;
    }

    const terms = normalizeText(q).split(" ").filter(Boolean);
    const results = catalog.filter((p) => {
      const hay = normalizeText(
        `${p.TITLE ?? ""} ${p.BRAND ?? ""} ${p.CATEGORY ?? ""} ${p.PART_NUMBER ?? ""}`
      );
      return terms.every((t) => hay.includes(t));
    });

    console.log(`🔵 [Invid nombre] "${q}" → ${results.length}`);
    return results;
  } catch (err) {
    console.error("❌ [Invid] fetchProductsFromInvid:", err.message);
    return [];
  }
}

// ── Public: búsqueda exacta por SKU ──────────────────────────────────────────
export async function fetchProductBySkuFromInvid(sku) {
  try {
    const catalog = await getInvidCatalogCached();

    const target = String(sku || "").trim();
    if (!target) return null;

    const tNorm = normSku(target);

    const found = catalog.find((p) => {
      return normSku(p.PART_NUMBER ?? "") === tNorm || normSku(p.ID ?? "") === tNorm;
    });

    console.log(`🔵 [Invid SKU exacto] "${target}" → ${found ? "encontrado" : "no encontrado"}`);
    return found ?? null;
  } catch (err) {
    console.error("❌ [Invid] fetchProductBySkuFromInvid:", err.message);
    return null;
  }
}
