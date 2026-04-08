// web/src/lib/services/microglobalAPI.js
//
// Estrategia: catálogo completo en un solo request SOAP (sin paginación).
// Protocolo: SOAP 1.1 — POST con Content-Type: text/xml y header SOAPAction.
// Auth: credenciales dentro del body SOAP (cliente + usuario + password).
// Método principal: GetCatalog — devuelve catálogo completo con precios y stock.

import axios from "axios";
import { cacheGet as redisCacheGet, cacheSet as redisCacheSet } from "@/lib/cache/redisCache";

// TEST: https://ws.microglobal.com.ar/WSMG_res_test/WSMG.asmx
// PROD: https://ws.microglobal.com.ar/WSMG_res/WSMG.asmx
const BASE_URL = process.env.MICROGLOBAL_URL ?? "https://ws.microglobal.com.ar/WSMG_res/WSMG.asmx";

// ── Cache keys & TTLs ────────────────────────────────────────────────────────
const CATALOG_REDIS_KEY = "microglobal:catalog:v1";
const CATALOG_LOCAL_TTL = 30 * 60 * 1000;  // 30 min en memoria
const CATALOG_REDIS_TTL = 6 * 60 * 60;     // 6h en Redis

// ── In-memory state ───────────────────────────────────────────────────────────
let catalogCache    = { ts: 0, items: [] };
let downloadPromise = null;

// ── Credentials ───────────────────────────────────────────────────────────────
function getCreds() {
  const cliente  = process.env.MICROGLOBAL_CLIENTE  ?? "923043";
  const usuario  = process.env.MICROGLOBAL_USUARIO  ?? "";
  const password = process.env.MICROGLOBAL_PASSWORD ?? "UTQ140";

  if (!cliente || !password) {
    console.warn("❌ [Microglobal] Faltan MICROGLOBAL_CLIENTE o MICROGLOBAL_PASSWORD");
    return null;
  }

  return { cliente, usuario, password };
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

// ── XML helpers ───────────────────────────────────────────────────────────────
// Extrae el texto de un tag XML (primera ocurrencia). Soporta tags vacíos.
function xmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

// Parsea la respuesta SOAP completa y retorna un array de objetos raw.
function parseSoapCatalog(xmlString) {
  // Verificar resultado funcional
  const result  = xmlTag(xmlString, "result");
  const message = xmlTag(xmlString, "message");

  if (result !== "0") {
    throw new Error(`Microglobal error funcional (result=${result}): ${message}`);
  }

  // Extraer todos los bloques <Product>
  const productRe = /<Product>([\s\S]*?)<\/Product>/gi;
  const products  = [];
  let match;

  while ((match = productRe.exec(xmlString)) !== null) {
    const block = match[1];

    products.push({
      partNumber:     xmlTag(block, "partNumber"),
      descripcion:    xmlTag(block, "descripcion"),
      precio:         xmlTag(block, "precio"),
      stock:          xmlTag(block, "stock"),
      iva_pct:        xmlTag(block, "iva_pct"),
      partNumber_ori: xmlTag(block, "partNumber_ori"),
      upc:            xmlTag(block, "upc"),
      codCategoria:   xmlTag(block, "codCategoria"),
      categoria:      xmlTag(block, "categoria"),
      codMarca:       xmlTag(block, "codMarca"),
      marca:          xmlTag(block, "marca"),
      bundle:         xmlTag(block, "bundle"),
      peso:           xmlTag(block, "peso"),
      ancho:          xmlTag(block, "ancho"),
      alto:           xmlTag(block, "alto"),
      profundidad:    xmlTag(block, "profundidad"),
      ii_pct:         xmlTag(block, "ii_pct"),
    });
  }

  return products;
}

// ── SOAP request builder ──────────────────────────────────────────────────────
function buildSoapBody(method, creds) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method} xmlns="http://tempuri.org/">
      <cliente>${creds.cliente}</cliente>
      <usuario>${creds.usuario}</usuario>
      <password>${creds.password}</password>
    </${method}>
  </soap:Body>
</soap:Envelope>`;
}

// ── Catalog fetch ─────────────────────────────────────────────────────────────
async function fetchMicroglobalCatalogRaw() {
  const creds = getCreds();
  if (!creds) return [];

  console.log("🔵 [Microglobal] Descargando catálogo completo (SOAP GetCatalog)...");

  const soapBody = buildSoapBody("GetCatalog", creds);

  const res = await axios.post(BASE_URL, soapBody, {
    headers: {
      "Content-Type": 'text/xml; charset=utf-8',
      "SOAPAction":   '"http://tempuri.org/GetCatalog"',
    },
    timeout: 60000,
    responseType: "text",
  });

  const products = parseSoapCatalog(res.data);
  console.log(`✅ [Microglobal] catálogo descargado: ${products.length} productos`);
  return products;
}

// ── Catalog cache (memory → Redis → API, fire-and-forget) ────────────────────
async function getMicroglobalCatalogCached() {
  const now = Date.now();

  // 1) memoria
  if (catalogCache.items.length && now - catalogCache.ts < CATALOG_LOCAL_TTL) {
    console.log(`🟦 [Microglobal local HIT] ${catalogCache.items.length} productos`);
    return catalogCache.items;
  }

  // 2) Redis
  const redisHit = await redisCacheGet(CATALOG_REDIS_KEY);
  if (redisHit && Array.isArray(redisHit) && redisHit.length) {
    console.log(`🟦 [Microglobal redis HIT] ${redisHit.length} productos`);
    catalogCache = { ts: now, items: redisHit };
    return redisHit;
  }

  // 3) descarga — singleton + fire-and-forget
  if (downloadPromise) {
    console.log("🔵 [Microglobal] descarga en curso (background), devolviendo []");
    return [];
  }

  console.log("🔵 [Microglobal MISS] iniciando descarga en background…");

  downloadPromise = fetchMicroglobalCatalogRaw()
    .then(async (items) => {
      if (!items.length) {
        console.warn("⚠️ [Microglobal] catálogo vacío");
        return [];
      }

      // Filtrar sin stock
      const withStock = items.filter((p) => Number(p.stock) > 0);
      console.log(`🔵 [Microglobal] con stock: ${withStock.length}/${items.length} productos`);

      catalogCache = { ts: Date.now(), items: withStock };
      await redisCacheSet(CATALOG_REDIS_KEY, withStock, CATALOG_REDIS_TTL);
      console.log(`✅ [Microglobal] catálogo en Redis: ${withStock.length} productos`);
      return withStock;
    })
    .catch((err) => {
      console.error("❌ [Microglobal] error en descarga background:", err.message);
      return [];
    })
    .finally(() => {
      downloadPromise = null;
    });

  return [];
}

// ── Warm check ────────────────────────────────────────────────────────────────
export function isMicroglobalCacheWarm() {
  if (downloadPromise !== null) return true;
  return catalogCache.items.length > 0 && Date.now() - catalogCache.ts < CATALOG_LOCAL_TTL;
}

// ── Public: búsqueda general ──────────────────────────────────────────────────
export async function fetchProductsFromMicroglobal(query = "") {
  try {
    const catalog = await getMicroglobalCatalogCached();

    const q = String(query || "").trim();
    if (!q) return catalog;

    if (isSku(q)) {
      const qNorm = normSku(q);
      const results = catalog.filter((p) => {
        const pn  = normSku(p.partNumber ?? "");
        const ori = normSku(p.partNumber_ori ?? "");
        const upc = normSku(p.upc ?? "");
        return pn === qNorm || ori === qNorm || upc === qNorm || pn.includes(qNorm);
      });
      console.log(`🔵 [Microglobal SKU] "${q}" → ${results.length}`);
      return results;
    }

    const terms = normalizeText(q).split(" ").filter(Boolean);
    const results = catalog.filter((p) => {
      const hay = normalizeText(
        `${p.descripcion ?? ""} ${p.marca ?? ""} ${p.categoria ?? ""} ${p.partNumber ?? ""}`
      );
      return terms.every((t) => hay.includes(t));
    });

    console.log(`🔵 [Microglobal nombre] "${q}" → ${results.length}`);
    return results;
  } catch (err) {
    console.error("❌ [Microglobal] fetchProductsFromMicroglobal:", err.message);
    return [];
  }
}

// ── Public: búsqueda exacta por SKU ──────────────────────────────────────────
export async function fetchProductBySkuFromMicroglobal(sku) {
  try {
    const catalog = await getMicroglobalCatalogCached();

    const target = String(sku || "").trim();
    if (!target) return null;

    const tNorm = normSku(target);

    const found = catalog.find((p) => {
      return (
        normSku(p.partNumber ?? "")     === tNorm ||
        normSku(p.partNumber_ori ?? "") === tNorm ||
        normSku(p.upc ?? "")            === tNorm
      );
    });

    console.log(`🔵 [Microglobal SKU exacto] "${target}" → ${found ? "encontrado" : "no encontrado"}`);
    return found ?? null;
  } catch (err) {
    console.error("❌ [Microglobal] fetchProductBySkuFromMicroglobal:", err.message);
    return null;
  }
}

// ── Sync bloqueante para cron ─────────────────────────────────────────────────
export async function syncMicroglobalCatalogToRedis() {
  const items = await fetchMicroglobalCatalogRaw();

  if (!items.length) {
    return { ok: false, error: "Catálogo vacío", total: 0, withStock: 0 };
  }

  const withStock = items.filter((p) => Number(p.stock) > 0);

  catalogCache = { ts: Date.now(), items: withStock };
  await redisCacheSet(CATALOG_REDIS_KEY, withStock, CATALOG_REDIS_TTL);

  console.log(`✅ [Microglobal sync] total: ${items.length} | con stock: ${withStock.length}`);
  return { ok: true, total: items.length, withStock: withStock.length };
}
