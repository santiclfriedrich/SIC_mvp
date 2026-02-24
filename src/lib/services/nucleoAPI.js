// web/src/lib/services/nucleoAPI.js
import axios from "axios";

const LOGIN_URL = "https://api.gruponucleosa.com/Authentication/Login";
const CATALOG_URL = "https://api.gruponucleosa.com/API_V1/GetCatalog";

let catalogCache = { ts: 0, items: [] };
const CATALOG_TTL_MS = 10 * 60 * 1000; // 10 min

/** Cache simple en memoria (por ejecución del server) */
let tokenCache = null;
let tokenCacheAt = 0;
// Ajustá si el token dura más/menos. Si no estás seguro: 10 min es prudente.
const TOKEN_TTL_MS = 10 * 60 * 1000;

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
    password: stripWrappingQuotes(NUCLEO_PASSWORD), // 👈 clave
  };
}

/** ================================
 * 🔵 LOGIN (con cache simple)
 * ================================ */
async function loginNucleo() {
  const creds = getCreds();
  if (!creds) return null;

  const now = Date.now();
  if (tokenCache && now - tokenCacheAt < TOKEN_TTL_MS) return tokenCache;

  try {
    // (debug útil sin exponer password)
    console.log("🔵 [Núcleo] Login payload:", {
      id: creds.id,
      username: creds.username,
      passwordLen: creds.password.length,
    });

    const res = await axios.post(LOGIN_URL, creds, {
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      timeout: 25000,
    });

    // ✅ según doc
    const token = res.data?.access_token || res.data?.token || res.data;

    // token debería ser string JWT
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
 * 🔵 BÚSQUEDA PRINCIPAL
 * ================================ */
export async function fetchProductsFromNucleo(query = "") {
  try {
    const now = Date.now();
    let products = [];

    // ----------------------------
    // ✅ Catálogo cacheado (evita pedir GetCatalog en cada búsqueda)
    // ----------------------------
    if (catalogCache.items.length && now - catalogCache.ts < CATALOG_TTL_MS) {
      products = catalogCache.items;
      console.log(`🟦 [Núcleo cache HIT] catálogo: ${products.length}`);
    } else {
      const token = await loginNucleo();
      if (!token) return [];

      console.log("🟦 [Núcleo cache MISS] descargando catálogo...");

      const res = await axios.get(CATALOG_URL, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000,
      });

      products = Array.isArray(res.data) ? res.data : [];
      catalogCache = { ts: now, items: products };

      console.log(`🟦 [Núcleo] catálogo cacheado: ${products.length}`);
    }

    // ----------------------------
    // ✅ Sin query => devolvés catálogo completo (cacheado)
    // ----------------------------
    if (!query) return products;

    // ----------------------------
    // ✅ Filtro local (igual que tu lógica)
    // ----------------------------
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

    // Si te tiró 401, podés invalidar token+catálogo para que re-loguee en el próximo intento
    if (err?.response?.status === 401) {
      tokenCache = null;
      tokenCacheAt = 0;
      catalogCache = { ts: 0, items: [] };
    }

    return [];
  }
}