// web/src/lib/services/nucleoAPI.js
import axios from "axios";

const LOGIN_URL = "https://api.gruponucleosa.com/Authentication/Login";
const CATALOG_URL = "https://api.gruponucleosa.com/API_V1/GetCatalog";

/** Cache simple en memoria (por ejecución del server) */
let tokenCache = null;
let tokenCacheAt = 0;
// Ajustá si el token dura más/menos. Si no estás seguro: 10 min es prudente.
const TOKEN_TTL_MS = 10 * 60 * 1000;

function getCreds() {
  const NUCLEO_ID = process.env.NUCLEO_ID;
  const NUCLEO_USER = process.env.NUCLEO_USER;
  const NUCLEO_PASSWORD = process.env.NUCLEO_PASSWORD;

  if (!NUCLEO_ID || !NUCLEO_USER || !NUCLEO_PASSWORD) {
    console.warn("❌ Núcleo → Faltan NUCLEO_ID, NUCLEO_USER o NUCLEO_PASSWORD");
    return null;
  }

  return {
    id: Number(NUCLEO_ID),
    username: String(NUCLEO_USER).trim(),
    password: String(NUCLEO_PASSWORD).trim(),
  };
}

/** ================================
 * 🔵 LOGIN (con cache simple)
 * ================================ */
async function loginNucleo() {
  const creds = getCreds();
  if (!creds) return null;

  const now = Date.now();
  if (tokenCache && now - tokenCacheAt < TOKEN_TTL_MS) {
    return tokenCache;
  }

  try {
    const res = await axios.post(LOGIN_URL, creds, {
      headers: { "Content-Type": "application/json" },
      timeout: 25000,
    });

    // Tu API devuelve el token directo en res.data
    const token = res.data;
    if (!token) return null;

    tokenCache = token;
    tokenCacheAt = now;
    return token;
  } catch (err) {
    console.error("❌ Núcleo login error:", err.response?.data || err.message);
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
    const token = await loginNucleo();
    if (!token) return [];

    const res = await axios.get(CATALOG_URL, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    });

    let products = Array.isArray(res.data) ? res.data : [];
    if (!query) return products;

    const trimmed = String(query).trim();
    const q = normalize(trimmed);
    const isSkuSearch = looksLikeSku(trimmed);

    console.log(
      `🔵 [Núcleo] Buscando "${trimmed}" como ${isSkuSearch ? "SKU" : "nombre"}`
    );

    products = products.filter((p) => {
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

    console.log(`🔵 [Núcleo] Resultados: ${products.length}`);
    return products;
  } catch (err) {
    console.error("❌ Error consultando Núcleo:", err.response?.data || err.message);
    return [];
  }
}
