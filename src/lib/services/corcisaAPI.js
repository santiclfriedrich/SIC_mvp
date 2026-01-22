// web/src/lib/services/corcisaAPI.js
import axios from "axios";

const BASE_URL = "https://corcisa.com.ar/api/v1/productos";

/**
 * Detecta si el query parece un SKU
 * Regla simple:
 * - sin espacios
 * - al menos un número
 * - caracteres típicos de SKU
 */
function isSku(query = "") {
  const q = String(query).trim();
  return q && !q.includes(" ") && /[0-9]/.test(q) && /[A-Z0-9/-]/i.test(q);
}

/**
 * 🔵 Búsqueda en Corcisa
 * - POST
 * - SKU → codigo_producto
 * - (por ahora) nombre NO se envía porque tu implementación original no lo usaba
 */
export async function fetchProductsFromCorcisa(query = "") {
  try {
    const CORCISA_USER_ID = process.env.CORCISA_USER_ID;
    const CORCISA_TOKEN = process.env.CORCISA_TOKEN;

    if (!CORCISA_USER_ID || !CORCISA_TOKEN) {
      console.error("❌ Corcisa → Falta CORCISA_USER_ID o CORCISA_TOKEN");
      return [];
    }

    const trimmed = String(query).trim();

    // Query params (filtros)
    const params = {
      limit: 100,
      offset: 0,
    };

    if (trimmed && isSku(trimmed)) {
      params.codigo_producto = trimmed;
    }

    // Body de autenticación
    const body = {
      user_id: CORCISA_USER_ID,
      token: CORCISA_TOKEN,
    };

    // Evitar loguear data sensible (esto no imprime el token)
    console.log("🔵 [Corcisa] POST filtros →", params);

    const res = await axios.post(BASE_URL, body, { params });

    const results = Array.isArray(res.data?.resultado) ? res.data.resultado : [];
    console.log(`🔵 [Corcisa] Resultados: ${results.length}`);

    return results;
  } catch (err) {
    console.error("❌ Error Corcisa:", err?.response?.data || err?.message || err);
    return [];
  }
}
