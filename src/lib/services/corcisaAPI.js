// web/src/lib/services/corcisaAPI.js
import axios from "axios";

const BASE_URL = "https://corcisa.com.ar/api/v1/productos";

function isSku(query = "") {
  const q = String(query).trim();
  return q && !q.includes(" ") && /[0-9]/.test(q) && /[A-Z0-9/-]/i.test(q);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function corcisaPost({ params, body, timeoutMs = 15000 }) {
  const res = await axios.post(BASE_URL, body, {
    params,
    timeout: timeoutMs,
    headers: { "Content-Type": "application/json" },
  });
  return res;
}

/**
 * ✅ Trae TODAS las páginas de Corcisa (hasta que devuelva < limit)
 * - limit máximo: 100
 * - offset incremental
 * - opcional: actualizacion (YYYY-MM-DD HH:MM)
 */
export async function fetchAllProductsFromCorcisa({
  limit = 100,
  actualizacion = null,
  maxPages = 5000, // guardrail
} = {}) {
  const CORCISA_USER_ID = process.env.CORCISA_USER_ID;
  const CORCISA_TOKEN = process.env.CORCISA_TOKEN;

  if (!CORCISA_USER_ID || !CORCISA_TOKEN) {
    console.error("❌ Corcisa → Falta CORCISA_USER_ID o CORCISA_TOKEN");
    return [];
  }

  const body = { user_id: CORCISA_USER_ID, token: CORCISA_TOKEN };

  let offset = 0;
  let page = 0;
  const all = [];

  while (page < maxPages) {
    page += 1;

    const params = { limit, offset };
    if (actualizacion) params.actualizacion = actualizacion;

    try {
      // Log sin token
      console.log(`🔵 [Corcisa] page ${page} limit ${limit} offset ${offset}`);

      const res = await corcisaPost({ params, body });
      const batch = Array.isArray(res.data?.resultado) ? res.data.resultado : [];

      all.push(...batch);

      console.log(`🟣 [Corcisa] batch: ${batch.length} acumulado: ${all.length}`);

      // fin si devolvió menos que el límite
      if (batch.length < limit) break;

      offset += limit;

      // mini pausa para no “pegarle” demasiado
      await sleep(150);
    } catch (err) {
      console.error("❌ Corcisa paginación error:", err?.response?.data || err?.message || err);
      break;
    }
  }

  return all;
}

/**
 * 🔵 Búsqueda (compat con tu flujo actual)
 * - Si es SKU: pide directo por codigo_producto (1 página)
 * - Si NO es SKU: trae TODO y filtra local por palabras (sin sesgo)
 */
export async function fetchProductsFromCorcisa(query = "") {
  const CORCISA_USER_ID = process.env.CORCISA_USER_ID;
  const CORCISA_TOKEN = process.env.CORCISA_TOKEN;

  if (!CORCISA_USER_ID || !CORCISA_TOKEN) {
    console.error("❌ Corcisa → Falta CORCISA_USER_ID o CORCISA_TOKEN");
    return [];
  }

  const trimmed = String(query).trim();
  const body = { user_id: CORCISA_USER_ID, token: CORCISA_TOKEN };

  // 1) SKU: server-side (rápido)
  if (trimmed && isSku(trimmed)) {
    const params = { limit: 100, offset: 0, codigo_producto: trimmed };
    console.log("🔵 [Corcisa] SKU POST filtros →", { limit: params.limit, offset: params.offset, codigo_producto: params.codigo_producto });

    try {
      const res = await corcisaPost({ params, body });
      const results = Array.isArray(res.data?.resultado) ? res.data.resultado : [];
      console.log(`🔵 [Corcisa] Resultados SKU: ${results.length}`);
      return results;
    } catch (err) {
      console.error("❌ Error Corcisa SKU:", err?.response?.data || err?.message || err);
      return [];
    }
  }

  // 2) Nombre / búsqueda general: traer TODO y filtrar local
  const all = await fetchAllProductsFromCorcisa({ limit: 100 });

  if (!trimmed) return all;

  const words = trimmed
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const filtered = all.filter((p) => {
    const name = String(p?.nombre || "").toLowerCase();
    const brand = String(p?.marca || "").toLowerCase();
    const hay = `${name} ${brand}`;
    return words.every((w) => hay.includes(w));
  });

  console.log(`🔵 [Corcisa] Filtrados por "${trimmed}": ${filtered.length} (de ${all.length})`);
  return filtered;
}