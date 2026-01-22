// web/src/lib/services/pcartsAPI.js
import axios from "axios";

function getPcartsConfig() {
  const BASE_URL =
    process.env.PCARTS_URL?.trim() || "https://api.pcarts.com/operations";
  const TOKEN = process.env.PCARTS_TOKEN?.trim();

  if (!TOKEN) {
    console.warn("❌ PCArts → Falta PCARTS_TOKEN");
    return null;
  }

  return { BASE_URL, TOKEN };
}

function buildHeaders(operation, token) {
  return {
    "content-type": "application/json",
    "x-session-token": token,
    operation: String(operation),
  };
}

// -------------------------------
// Cache simple en memoria (por ejecución del server)
// -------------------------------
let cacheCatalog = null;
let cacheStock = null;
let cacheAt = 0;

// Ajustá TTL según necesidad (por ejemplo 10 min)
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheValid() {
  return cacheAt && Date.now() - cacheAt < CACHE_TTL_MS;
}

function setCache({ catalog, stock }) {
  cacheCatalog = catalog;
  cacheStock = stock;
  cacheAt = Date.now();
}

function clearCache() {
  cacheCatalog = null;
  cacheStock = null;
  cacheAt = 0;
}

// -------------------------------
// Operación 1005 → Catálogo
// -------------------------------
async function fetchPcartsCatalog() {
  const cfg = getPcartsConfig();
  if (!cfg) return [];

  const headers = buildHeaders(1005, cfg.TOKEN);
  const params = { offset: 0, limit: 5000 };

  try {
    const res = await axios.get(cfg.BASE_URL, { headers, params, timeout: 30000 });
    return Array.isArray(res.data?.Products) ? res.data.Products : [];
  } catch (err) {
    console.error("❌ PCArts 1005 (Catálogo) error:", err.response?.data || err.message);
    return [];
  }
}

// -------------------------------
// Operación 1004 → Stock + Precio
// -------------------------------
async function fetchPcartsStock() {
  const cfg = getPcartsConfig();
  if (!cfg) return [];

  const headers = buildHeaders(1004, cfg.TOKEN);
  const params = { offset: 0, limit: 5000 };

  try {
    const res = await axios.get(cfg.BASE_URL, { headers, params, timeout: 30000 });
    return Array.isArray(res.data?.Products) ? res.data.Products : [];
  } catch (err) {
    console.error("❌ PCArts 1004 (Stock) error:", err.response?.data || err.message);
    return [];
  }
}

// -------------------------------
// Unifica Catálogo (1005) + Stock (1004)
// Cachea el resultado para evitar 2 requests pesadas por búsqueda
// -------------------------------
async function getUnifiedPcartsDataset() {
  if (cacheValid() && Array.isArray(cacheCatalog) && Array.isArray(cacheStock)) {
    return { catalog: cacheCatalog, stock: cacheStock };
  }

  const [catalog, stock] = await Promise.all([fetchPcartsCatalog(), fetchPcartsStock()]);
  setCache({ catalog, stock });
  return { catalog, stock };
}

// -------------------------------
// FUNCIÓN PRINCIPAL
// -------------------------------
export async function fetchProductsFromPcarts(query = "") {
  try {
    console.log("🔵 PCArts → consultando 1004 + 1005...");

    const { catalog, stock } = await getUnifiedPcartsDataset();

    console.log(`🔵 PCArts → Catálogo: ${catalog.length}, Stock: ${stock.length}`);

    // Indexamos stock/precio por SKU
    const stockMap = new Map();
    for (const s of stock) {
      if (!s?.sku) continue;
      stockMap.set(s.sku, {
        price: Number(s.price) || 0,
        stock: Number(s.stock) || 0,
        sku_date_updated: s.sku_date_updated || null,
      });
    }

    // Unificamos tomando como base el catálogo
    let unified = catalog.map((c) => {
      const sInfo = stockMap.get(c.sku) || {};
      return {
        ...c,
        price: sInfo.price ?? 0,
        stock: sInfo.stock ?? 0,
        sku_date_updated: sInfo.sku_date_updated ?? null,
      };
    });

    if (!query) return unified;

    const q = String(query).trim().toLowerCase();
    if (!q) return unified;

    unified = unified.filter((p) => {
      return (
        String(p.sku || "").toLowerCase().includes(q) ||
        String(p.sku_desc || "").toLowerCase().includes(q)
      );
    });

    return unified;
  } catch (err) {
    console.error("❌ Error general PCArts:", err.response?.data || err.message);
    return [];
  }
}

// -------------------------------
// SKU exacto (sin cache global, porque la API ya filtra)
// -------------------------------
export async function fetchProductBySkuFromPcarts(sku) {
  const cfg = getPcartsConfig();
  if (!cfg) return null;

  const SKU = String(sku || "").trim();
  if (!SKU) return null;

  try {
    const headersCatalog = buildHeaders(1005, cfg.TOKEN);
    const headersStock = buildHeaders(1004, cfg.TOKEN);

    const params = { offset: 0, limit: 100, sku: SKU };

    // 1005 → catálogo
    const catRes = await axios.get(cfg.BASE_URL, {
      headers: headersCatalog,
      params,
      timeout: 30000,
    });

    const catalog = Array.isArray(catRes.data?.Products) ? catRes.data.Products : [];
    if (catalog.length === 0) return null;

    const product = catalog[0];

    // 1004 → stock + precio
    const stockRes = await axios.get(cfg.BASE_URL, {
      headers: headersStock,
      params,
      timeout: 30000,
    });

    const stockList = Array.isArray(stockRes.data?.Products) ? stockRes.data.Products : [];
    const stockInfo = stockList[0] || {};

    return {
      ...product,
      price: Number(stockInfo.price) || 0,
      stock: Number(stockInfo.stock) || 0,
      sku_date_updated: stockInfo.sku_date_updated || null,
    };
  } catch (err) {
    console.error("❌ Error en fetchProductBySkuFromPcarts:", err.response?.data || err.message);
    return null;
  }
}

// Opcional: para forzar refresh desde algún endpoint admin interno
export function __pcartsClearCacheForDebug() {
  clearCache();
}
