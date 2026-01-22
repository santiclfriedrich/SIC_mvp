// web/src/lib/services/masnetAPI.js

import axios from "axios";

/**
 * Detecta si el query parece un SKU
 * - no espacios
 * - al menos un número
 */
function isSku(query = "") {
  const q = String(query).trim();
  return q && !q.includes(" ") && /\d/.test(q);
}

function getCreds() {
  const MASNET_USER_ID = process.env.MASNET_USER_ID;
  const MASNET_TOKEN = process.env.MASNET_TOKEN;
  const MASNET_URL = process.env.MASNET_URL;

  if (!MASNET_USER_ID || !MASNET_TOKEN || !MASNET_URL) {
    console.warn("❌ Masnet → Faltan MASNET_USER_ID, MASNET_TOKEN o MASNET_URL");
    return null;
  }

  return {
    user_id: String(MASNET_USER_ID).trim(),
    token: String(MASNET_TOKEN).trim(),
    url: String(MASNET_URL).trim(),
  };
}

/**
 * 🔵 Búsqueda en Masnet
 * - POST
 * - SKU → codigo_producto
 * - Nombre → nombre (mínimo 3 caracteres)
 */
export async function fetchProductsFromMasnet(query = "") {
  const creds = getCreds();
  if (!creds) return [];

  const trimmed = String(query || "").trim();

  // Body base
  const body = {
    user_id: creds.user_id,
    token: creds.token,
    limit: 100,
    offset: 0,
  };

  // Filtro por SKU o nombre
  if (trimmed) {
    if (isSku(trimmed)) {
      body.codigo_producto = trimmed;
    } else if (trimmed.length >= 3) {
      body.nombre = trimmed;
    }
  }

  try {
    console.log("🔵 [Masnet] POST →", { ...body, token: "***" });

    const res = await axios.post(creds.url, body, {
      headers: { "Content-Type": "application/json" },
      timeout: 25000,
    });

    const results = Array.isArray(res.data?.resultado) ? res.data.resultado : [];
    console.log(`🔵 [Masnet] Resultados: ${results.length}`);

    return results;
  } catch (err) {
    console.error("❌ Error Masnet:", err.response?.data || err.message);
    return [];
  }
}
