// web/src/lib/services/solutionboxAPI.js
//
// Estrategia: catálogo completo en un solo GET (sin paginación), token Basic Auth (7 días).
// Auth: POST /api/usuario/createToken con Basic Auth → token Bearer
// Catalog: GET /api/listas/articulos — devuelve todo el catálogo de una vez.
// Rate limit: 2 requests/hora en prod → Redis TTL 6h para no exceder el límite.

import axios from "axios";
import { cacheGet as redisCacheGet, cacheSet as redisCacheSet } from "@/lib/cache/redisCache";

// SOLUTIONBOX_URL apunta al sandbox en desarrollo; cambiar a prod en producción.
// Sandbox: https://sandboxlxc.solutionbox.com.ar
// Prod:    https://lxc.solutionbox.com.ar
const BASE_URL = process.env.SOLUTIONBOX_URL ?? "https://sandboxlxc.solutionbox.com.ar";

// Sandbox y prod usan paths distintos
const isSandbox       = BASE_URL.includes("sandbox");
const TOKEN_PATH      = isSandbox ? "/token"    : "/api/usuario/createToken";
const CATALOG_PATH    = isSandbox ? "/articles" : "/api/listas/articulos";

// ── Cache keys & TTLs ────────────────────────────────────────────────────────
const CATALOG_REDIS_KEY = "solutionbox:catalog:v2"; // v2 = prod (v1 era sandbox)
const CATALOG_LOCAL_TTL = 30 * 60 * 1000;   // 30 min en memoria
const CATALOG_REDIS_TTL = 6 * 60 * 60;      // 6h en Redis — respeta límite de 2 req/hora

const TOKEN_REDIS_KEY   = "solutionbox:token:v2";   // v2 = prod (v1 era sandbox)
const TOKEN_TTL_MS      = 6 * 24 * 60 * 60 * 1000; // 6 días en memoria (token válido 7 días)
const TOKEN_REDIS_TTL   = 6 * 24 * 60 * 60;         // 6 días en Redis

// ── In-memory state ───────────────────────────────────────────────────────────
let catalogCache    = { ts: 0, items: [] };
let tokenCache      = { ts: 0, token: null };
let downloadPromise = null;

// ── Credentials ───────────────────────────────────────────────────────────────
function getCreds() {
  const username = process.env.SOLUTIONBOX_USERNAME;
  const password = process.env.SOLUTIONBOX_PASSWORD;

  if (!username || !password) {
    console.warn("❌ [SolutionBox] Faltan SOLUTIONBOX_USERNAME o SOLUTIONBOX_PASSWORD");
    return null;
  }

  return { username: String(username).trim(), password: String(password).trim() };
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

// ── Token (Basic Auth → Bearer, cache memory + Redis) ────────────────────────
async function getSolutionboxToken() {
  const now = Date.now();

  // 1) memoria
  if (tokenCache.token && now - tokenCache.ts < TOKEN_TTL_MS) {
    return tokenCache.token;
  }

  // 2) Redis (el token dura 7 días, vale persistirlo)
  const redisToken = await redisCacheGet(TOKEN_REDIS_KEY);
  if (redisToken && typeof redisToken === "string") {
    console.log("🟦 [SolutionBox] token desde Redis");
    tokenCache = { ts: now, token: redisToken };
    return redisToken;
  }

  // 3) obtener nuevo token
  const creds = getCreds();
  if (!creds) return null;

  console.log("🔵 [SolutionBox] Obteniendo token...");

  const basicAuth = Buffer.from(`${creds.username}:${creds.password}`).toString("base64");

  const res = await axios.post(
    `${BASE_URL}${TOKEN_PATH}`,
    {},
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    }
  );

  const token = res.data?.token ?? null;
  if (!token) {
    throw new Error("SolutionBox auth: token no encontrado en la respuesta");
  }

  tokenCache = { ts: now, token };
  await redisCacheSet(TOKEN_REDIS_KEY, token, TOKEN_REDIS_TTL);
  console.log("✅ [SolutionBox] Token obtenido y cacheado");
  return token;
}

// ── Catalog fetch (sin paginación — devuelve todo de una vez) ─────────────────
async function fetchSolutionboxCatalogRaw(token) {
  console.log("🔵 [SolutionBox] Descargando catálogo completo...");

  const res = await axios.get(`${BASE_URL}${CATALOG_PATH}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });

  const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.articulos ?? []);

  if (data.length > 0) {
    console.log("🔵 [SolutionBox] primer producto (debug):", JSON.stringify(data[0]).slice(0, 300));
  }

  console.log(`✅ [SolutionBox] catálogo descargado: ${data.length} productos`);
  return data;
}

// ── Catalog cache (memory → Redis → API, fire-and-forget) ────────────────────
async function getSolutionboxCatalogCached() {
  const now = Date.now();

  // 1) memoria
  if (catalogCache.items.length && now - catalogCache.ts < CATALOG_LOCAL_TTL) {
    console.log(`🟦 [SolutionBox local HIT] ${catalogCache.items.length} productos`);
    return catalogCache.items;
  }

  // 2) Redis
  const redisHit = await redisCacheGet(CATALOG_REDIS_KEY);
  if (redisHit && Array.isArray(redisHit) && redisHit.length) {
    console.log(`🟦 [SolutionBox redis HIT] ${redisHit.length} productos`);
    catalogCache = { ts: now, items: redisHit };
    return redisHit;
  }

  // 3) descarga — singleton + fire-and-forget
  if (downloadPromise) {
    console.log("🔵 [SolutionBox] descarga en curso (background), devolviendo []");
    return [];
  }

  const token = await getSolutionboxToken();
  if (!token) return [];

  console.log("🔵 [SolutionBox MISS] iniciando descarga en background…");

  downloadPromise = fetchSolutionboxCatalogRaw(token)
    .then(async (items) => {
      if (!items.length) {
        console.warn("⚠️ [SolutionBox] catálogo vacío");
        return [];
      }

      // Filtrar sin stock
      const withStock = items.filter((p) => Number(p.Stock) > 0);
      console.log(`🔵 [SolutionBox] con stock: ${withStock.length}/${items.length} productos`);

      catalogCache = { ts: Date.now(), items: withStock };
      await redisCacheSet(CATALOG_REDIS_KEY, withStock, CATALOG_REDIS_TTL);
      console.log(`✅ [SolutionBox] catálogo en Redis: ${withStock.length} productos`);
      return withStock;
    })
    .catch((err) => {
      console.error("❌ [SolutionBox] error en descarga background:", err.message);
      return [];
    })
    .finally(() => {
      downloadPromise = null;
    });

  return [];
}

// ── Warm check ────────────────────────────────────────────────────────────────
export function isSolutionboxCacheWarm() {
  if (downloadPromise !== null) return true;
  return catalogCache.items.length > 0 && Date.now() - catalogCache.ts < CATALOG_LOCAL_TTL;
}

// ── Public: búsqueda general ──────────────────────────────────────────────────
export async function fetchProductsFromSolutionbox(query = "") {
  try {
    const catalog = await getSolutionboxCatalogCached();

    const q = String(query || "").trim();
    if (!q) return catalog;

    if (isSku(q)) {
      const qNorm = normSku(q);
      const results = catalog.filter((p) => {
        const pn = normSku(p.Numero_de_Parte ?? "");
        const al = normSku(p.Alias ?? "");
        return pn === qNorm || al === qNorm || pn.includes(qNorm);
      });
      console.log(`🔵 [SolutionBox SKU] "${q}" → ${results.length}`);
      return results;
    }

    const terms = normalizeText(q).split(" ").filter(Boolean);
    const results = catalog.filter((p) => {
      const hay = normalizeText(
        `${p.Descripcion ?? ""} ${p.Marca ?? ""} ${p.Categorias ?? ""} ${p.Numero_de_Parte ?? ""}`
      );
      return terms.every((t) => hay.includes(t));
    });

    console.log(`🔵 [SolutionBox nombre] "${q}" → ${results.length}`);
    return results;
  } catch (err) {
    console.error("❌ [SolutionBox] fetchProductsFromSolutionbox:", err.message);
    return [];
  }
}

// ── Public: búsqueda exacta por SKU ──────────────────────────────────────────
export async function fetchProductBySkuFromSolutionbox(sku) {
  try {
    const catalog = await getSolutionboxCatalogCached();

    const target = String(sku || "").trim();
    if (!target) return null;

    const tNorm = normSku(target);

    const found = catalog.find((p) => {
      return (
        normSku(p.Numero_de_Parte ?? "") === tNorm ||
        normSku(p.Alias ?? "") === tNorm
      );
    });

    console.log(`🔵 [SolutionBox SKU exacto] "${target}" → ${found ? "encontrado" : "no encontrado"}`);
    return found ?? null;
  } catch (err) {
    console.error("❌ [SolutionBox] fetchProductBySkuFromSolutionbox:", err.message);
    return null;
  }
}
