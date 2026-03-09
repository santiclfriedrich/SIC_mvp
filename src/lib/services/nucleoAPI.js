// web/src/lib/services/nucleoAPI.js
import axios from "axios";
import { cacheGet as redisCacheGet, cacheSet as redisCacheSet } from "@/lib/cache/redisCache";

const LOGIN_URL = "https://api.gruponucleosa.com/Authentication/Login";
const CATALOG_URL = "https://api.gruponucleosa.com/API_V1/GetCatalog";

// -------------------------------
// Cache catálogo: local + redis
// -------------------------------
let catalogCache = { ts: 0, items: [] };
const CATALOG_LOCAL_TTL_MS = 10 * 60 * 1000; // 10 min
const CATALOG_REDIS_TTL_S = 10 * 60; // 10 min

// -------------------------------
// Cache token: solo local
// -------------------------------
let tokenCache = null;
let tokenCacheAt = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 min

function stripWrappingQuotes(s) {
  const t = String(s ?? "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function getCreds() {
  const NUCLEO_ID = process.env.NUCLEO_ID;
  const NUCLEO_USER = process.env.NUCLEO_USER;
  const NUCLEO_PASSWORD = process.env.NUCLEO_PASSWORD;

  if (!NUCLEO_ID || !NUCLEO_USER || !NUCLEO_PASSWORD) {
    console.warn("❌ Núcleo → Faltan NUCLEO_ID, NUCLEO_USER o NUCLEO_PASSWORD");
    return null;
  }

  return {
    id: Number(String(NUCLEO_ID).trim()),
    username: String(NUCLEO_USER).trim(),
    password: stripWrappingQuotes(NUCLEO_PASSWORD),
  };
}

/** ================================
 * 🔵 LOGIN (cache local)
 * ================================ */
async function loginNucleo() {
  const creds = getCreds();
  if (!creds) return null;

  const now = Date.now();
  if (tokenCache && now - tokenCacheAt < TOKEN_TTL_MS) {
    return tokenCache;
  }

  try {
    console.log("🔵 [Núcleo] Login payload:", {
      id: creds.id,
      username: creds.username,
      passwordLen: creds.password.length,
    });

    const res = await axios.post(LOGIN_URL, creds, {
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      timeout: 25000,
    });

    const token = res.data?.access_token || res.data?.token || res.data;

    if (typeof token !== "string" || token.length < 20) {
      console.error("❌ Núcleo login: token inválido:", res.data);
      return null;
    }

    tokenCache = token;
    tokenCacheAt = now;
    return token;
  } catch (err) {
    console.error(
      "❌ Núcleo login error:",
      err.response?.status,
      err.response?.data || err.message
    );
    tokenCache = null;
    tokenCacheAt = 0;
    return null;
  }
}

/** ================================
 * 🔵 DETECCIÓN SIMPLE DE SKU
 * ================================ */
function looksLikeSku(q = "") {
  const t = String(q).trim();
  return t && !t.includes(" ") && /\d/.test(t);
}

/** ================================
 * 🔵 NORMALIZACIÓN DE TEXTO
 * ================================ */
function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/notebook|laptop|portátil/g, "note")
    .replace(/\bnb\b/g, "note")
    .trim();
}

/** ================================
 * 🔵 CATÁLOGO COMPLETO (local + redis)
 * ================================ */
async function getNucleoCatalogCached() {
  const now = Date.now();
  const redisKey = "nucleo:catalog:v1";

  // 1) local cache
  if (catalogCache.items.length && now - catalogCache.ts < CATALOG_LOCAL_TTL_MS) {
    console.log(`🟦 [Núcleo local HIT] catálogo: ${catalogCache.items.length}`);
    return catalogCache.items;
  }

  // 2) redis cache
  const redisHit = await redisCacheGet(redisKey);
  if (redisHit && Array.isArray(redisHit) && redisHit.length) {
    console.log(`🟦 [Núcleo redis HIT] catálogo: ${redisHit.length}`);
    catalogCache = { ts: now, items: redisHit };
    return redisHit;
  }

  // 3) request real
  const token = await loginNucleo();
  if (!token) return [];

  console.log("🟦 [Núcleo MISS] descargando catálogo...");

  const res = await axios.get(CATALOG_URL, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });

  const products = Array.isArray(res.data) ? res.data : [];

  catalogCache = { ts: now, items: products };
  await redisCacheSet(redisKey, products, CATALOG_REDIS_TTL_S);

  console.log(`🟦 [Núcleo] catálogo cacheado: ${products.length}`);
  return products;
}

/** ================================
 * 🔵 BÚSQUEDA PRINCIPAL
 * ================================ */
export async function fetchProductsFromNucleo(query = "") {
  try {
    const products = await getNucleoCatalogCached();

    if (!query) return products;

    const trimmed = String(query).trim();
    const q = normalize(trimmed);
    const isSkuSearch = looksLikeSku(trimmed);

    console.log(
      `🔵 [Núcleo] Buscando "${trimmed}" como ${isSkuSearch ? "SKU" : "nombre"}`
    );

    const filtered = products.filter((p) => {
      const name = normalize(p?.item_desc_0 || "");
      const partNumber = String(p?.partNumber || "").toLowerCase();

      // 🔍 SKU → partNumber
      if (isSkuSearch) {
        return partNumber === q || partNumber.includes(q);
      }

      // 🔍 Nombre → mínimo 3 caracteres
      if (q.length < 3) return false;
      return name.includes(q);
    });

    console.log(`🔵 [Núcleo] Resultados: ${filtered.length}`);
    return filtered;
  } catch (err) {
    console.error(
      "❌ Error consultando Núcleo:",
      err.response?.status,
      err.response?.data || err.message
    );

    // si falla auth, limpiamos token + catálogo local
    if (err?.response?.status === 401) {
      tokenCache = null;
      tokenCacheAt = 0;
      catalogCache = { ts: 0, items: [] };
    }

    return [];
  }
}