// web/src/lib/cache/masnetCatalogCache.js

/**
 * Masnet Catalog Cache (CSV)
 * - Descarga CSV completo en 1 request
 * - Lo parsea a objetos normalizados (keys "estilo API")
 * - Cache:
 *   - memoria (rápido)
 *   - archivo /tmp (persistencia básica en serverless)
 *
 * TTL por defecto: 30 min
 */

import fs from "fs";
import path from "path";

const TTL_MS = 30 * 60 * 1000; // 30 min
const TMP_FILE = path.join("/tmp", "masnet_catalog_cache.json");

let MEM = {
  ts: 0,
  items: [],
};

// ---------- CSV parsing helpers (sin dependencias) ----------

function detectDelimiter(headerLine = "") {
  const candidates = [",", ";", "\t", "|"];
  const counts = candidates.map((d) => ({
    d,
    c: (headerLine.match(new RegExp(`\\${d}`, "g")) || []).length,
  }));
  counts.sort((a, b) => b.c - a.c);
  return counts[0]?.c ? counts[0].d : ","; // default ,
}

function parseCSVLine(line, delim) {
  // Soporta comillas dobles y delimitadores dentro de comillas
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"'; // escape "" -> "
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delim) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toHeaderKey(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function pick(row, keys, fallback = "") {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function num(v, def = 0) {
  if (v === null || v === undefined) return def;

  let s = String(v).trim();
  if (!s) return def;

  // Si tiene coma, asumimos formato argentino
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

function parsePrice(v) {
  return num(v, 0);
}

function parseIva(v) {
  const n = num(v, 21);

  // Masnet CSV: 105 => 10.5
  if (n > 100 && n <= 1000) return n / 10;

  return n;
}

function normalizeMasnetRow(row) {
  // Intentamos mapear a lo que tu app espera (igual que el JSON)
  const codigo_producto = String(
    pick(row, ["codigo_producto", "sku", "codigo", "cod_producto", "codigo_fabricante"], "")
  ).trim();

  const codigo_alfa = String(pick(row, ["codigo_alfa", "codigoalfa"], "")).trim();
  const nombre = String(pick(row, ["nombre", "descripcion", "producto", "name"], "")).trim();
  const marca = String(pick(row, ["marca", "brand"], "")).trim();

  const precioRaw = pick(row, ["precio", "price", "precio_final", "precio_lista"], 0);
  const ivaRaw = pick(row, ["iva", "alicuota_iva"], 21);

  const precio = parsePrice(precioRaw);
  const iva = parseIva(ivaRaw);

  const monedaRaw = pick(row, ["moneda", "currency"], 1);
  const moneda = Number(monedaRaw) || (String(monedaRaw).toUpperCase() === "ARS" ? 1 : 2);

  const stock_total = num(pick(row, ["stock_total", "stock", "disponible", "cantidad"], 0), 0);
  const nivel_stock = String(pick(row, ["nivel_stock", "estado_stock"], "")).trim();

  const link = String(pick(row, ["link", "url"], "")).trim();

  // Imagen: algunas APIs mandan "imagen" o "imagenes" en CSV
  const img = String(pick(row, ["imagen", "imagenes", "image", "foto"], "")).trim();
  const imagenes =
    img && img !== "-"
      ? [img.startsWith("http") ? img : `https://masnet.com.ar${img}`]
      : [];

  return {
    codigo_producto,
    codigo_alfa,
    nombre,
    marca,
    precio,
    iva,
    moneda,
    nivel_stock,
    stock_total,
    link,
    imagenes,
  };
}

function parseCSV(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");

  if (!lines.length) return [];

  const delim = detectDelimiter(lines[0]);
  const headersRaw = parseCSVLine(lines[0], delim);
  const headers = headersRaw.map(toHeaderKey);

  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delim);
    if (!cols.length) continue;

    const row = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = cols[c] ?? "";
    }

    const normalized = normalizeMasnetRow(row);
    // descartamos filas sin SKU/código
    if (!normalized.codigo_producto && !normalized.codigo_alfa) continue;

    items.push(normalized);
  }

  return items;
}

// ---------- Cache IO ----------

function readTmpCache() {
  try {
    if (!fs.existsSync(TMP_FILE)) return null;
    const raw = fs.readFileSync(TMP_FILE, "utf8");
    const json = JSON.parse(raw);
    if (!json?.ts || !Array.isArray(json?.items)) return null;
    return json;
  } catch {
    return null;
  }
}

function writeTmpCache(ts, items) {
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify({ ts, items }), "utf8");
  } catch {
    // noop
  }
}

// ---------- Public API ----------

/** Returns true if the in-memory catalog is populated and within TTL. */
export function isMasnetCatalogWarm() {
  return MEM.items.length > 0 && Date.now() - MEM.ts < TTL_MS;
}

export async function refreshMasnetCatalogFromCSV() {
  const user_id = process.env.MASNET_USER_ID;
  const token = process.env.MASNET_TOKEN;

  if (!user_id || !token) {
    throw new Error("Masnet CSV → faltan MASNET_USER_ID o MASNET_TOKEN");
  }

  const url = `https://masnet.com.ar/api/v1/productos/csv?user_id=${encodeURIComponent(
    String(user_id).trim()
  )}&token=${encodeURIComponent(String(token).trim())}`;

  // IMPORTANTE: NO loguear token
  console.log("🟠 [Masnet CSV] descargando catálogo (CSV)…");

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 18000); // 18s hard cap

  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/csv,*/*" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(abortTimer);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Masnet CSV HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }

  const csvText = await res.text();
  const items = parseCSV(csvText);

  const ts = Date.now();
  MEM = { ts, items };
  writeTmpCache(ts, items);

  console.log("🟠 [Masnet CSV] catálogo OK →", items.length, "items");
  return items;
}

export async function getMasnetCatalogCached({ force = false } = {}) {
  const now = Date.now();

  // 1) memoria
  if (!force && MEM.items.length && now - MEM.ts < TTL_MS) return MEM.items;

  // 2) /tmp
  if (!force) {
    const tmp = readTmpCache();
    if (tmp?.items?.length && now - tmp.ts < TTL_MS) {
      MEM = tmp;
      return MEM.items;
    }
  }

  // 3) refresh
  return await refreshMasnetCatalogFromCSV();
}