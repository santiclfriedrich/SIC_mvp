// web/src/lib/services/elitAPI.js

import axios from "axios";

const BASE_URL = "https://clientes.elit.com.ar/v1/api";

/**
 * Detecta si el query parece un SKU
 * Regla simple y efectiva:
 * - no espacios
 * - tiene al menos un número
 */
function isSku(query = "") {
  const q = String(query).trim();
  return q && !q.includes(" ") && /\d/.test(q);
}

function getCreds() {
  const ELIT_USER_ID = process.env.ELIT_USER_ID;
  const ELIT_TOKEN = process.env.ELIT_TOKEN;

  if (!ELIT_USER_ID || !ELIT_TOKEN) {
    // En Next esto se lee de web/.env.local (solo server-side)
    console.warn("❌ Elit → Falta ELIT_USER_ID o ELIT_TOKEN");
    return null;
  }

  return {
    user_id: Number(ELIT_USER_ID),
    token: String(ELIT_TOKEN).trim(),
  };
}

// =======================================================
// 🔎 BÚSQUEDA GENERAL (SKU o nombre)
// =======================================================
export async function fetchProductsFromElit(query = "") {
  const creds = getCreds();
  if (!creds) return [];

  const params = new URLSearchParams();
  params.set("limit", "100");

  const trimmed = String(query || "").trim();
  if (trimmed) {
    if (isSku(trimmed)) params.set("codigo_producto", trimmed);
    else params.set("nombre", trimmed);
  }

  const url = `${BASE_URL}/productos?${params.toString()}`;

  try {
    console.log("🔵 [Elit] URL:", url);

    const res = await axios.post(url, creds, {
      headers: { "Content-Type": "application/json" },
      timeout: 25000,
    });

    return Array.isArray(res.data?.resultado) ? res.data.resultado : [];
  } catch (err) {
    console.error("❌ Error Elit:", err.response?.data || err.message);
    return [];
  }
}

// =======================================================
// 🔍 BÚSQUEDA EXACTA POR SKU (para /api/products/:sku)
// =======================================================
export async function fetchProductBySkuFromElit(sku) {
  const creds = getCreds();
  if (!creds) return null;

  const skuTrim = String(sku || "").trim();
  if (!skuTrim) return null;

  const url = `${BASE_URL}/productos?limit=100&codigo_producto=${encodeURIComponent(skuTrim)}`;

  try {
    const res = await axios.post(url, creds, {
      headers: { "Content-Type": "application/json" },
      timeout: 25000,
    });

    const products = Array.isArray(res.data?.resultado) ? res.data.resultado : [];
    return products.length > 0 ? products[0] : null;
  } catch (err) {
    console.error("❌ Error SKU Elit:", err.response?.data || err.message);
    return null;
  }
}
