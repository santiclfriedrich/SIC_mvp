// web/src/lib/controllers/productController.js

import { mergeResults } from "@/lib/utils/mergeResults";
import { cleanMergedProduct } from "@/lib/utils/cleanMergedProduct";
import { withTimeout } from "@/lib/utils/withTimeout";

// Services
import { fetchProductsFromElit, fetchProductBySkuFromElit, isElitCacheWarm } from "@/lib/services/elitAPI";
import { fetchProductsFromMasnet, fetchProductBySkuFromMasnet, isMasnetCacheWarm } from "@/lib/services/masnetAPI";
import { fetchProductsFromCorcisa, isCorcisaCacheWarm } from "@/lib/services/corcisaAPI";
import { fetchProductsFromNucleo, isNucleoCacheWarm } from "@/lib/services/nucleoAPI";
import { fetchProductsFromPcarts, fetchProductBySkuFromPcarts, isPcartsCacheWarm } from "@/lib/services/pcartsAPI";
import { fetchProductsFromInvid, fetchProductBySkuFromInvid, isInvidCacheWarm } from "@/lib/services/invidAPI";

// Models
import {
  formatElitProducts,
  formatMasnetProducts,
  formatCorcisaProducts,
  formatNucleoProducts,
  formatPcartsProducts,
  formatPcartsSingle,
  formatInvidProducts,
} from "@/lib/models";

// ---------------------------------------------------------------------------
// Timeout budgets per provider
//
// warmMs → local in-memory cache is hot: Redis path is fast (~100-400ms)
// coldMs → cache is cold; provider must do real I/O:
//   • Nucleo:  login POST (≤5s) + catalog GET (≤8s) = up to ~13s
//   • PCArts:  2 parallel GETs (≤8s each)          = up to ~8s
//   • Masnet:  CSV download + parse                 = up to ~15s
//   • Corcisa: paginated catalog (Redis if warm)    = up to ~15s
//   • Elit:    single POST                          = up to ~5s
// ---------------------------------------------------------------------------
const PROVIDER_TIMEOUTS = {
  Elit:    { warmMs: 2500, coldMs: 10000 },
  Masnet:  { warmMs: 2500, coldMs: 20000 },
  Corcisa: { warmMs: 2500, coldMs: 20000 },
  Nucleo:  { warmMs: 2500, coldMs: 20000 },
  PCArts:  { warmMs: 2500, coldMs: 15000 },
  Invid:   { warmMs: 2500, coldMs: 45000 },
};

// ---------------------------------------------------------------------------
// Error classification
// Covers both native fetch errors (undici / Node) and axios errors.
// ---------------------------------------------------------------------------
function classifyError(err) {
  const code = err.code ?? err.cause?.code ?? null;
  const msg  = String(err.message ?? "").toLowerCase();

  if (code === "TIMEOUT")        return "TIMEOUT";
  if (code === "ENOTFOUND"       || msg.includes("enotfound"))   return "DNS_FAILURE";
  if (code === "ECONNREFUSED"    || msg.includes("econnrefused")) return "CONN_REFUSED";
  if (code === "ECONNRESET"      || msg.includes("econnreset"))   return "CONN_RESET";
  if (code === "ETIMEDOUT"       || msg.includes("etimedout"))    return "NET_TIMEOUT";
  if (msg.includes("fetch failed"))                               return "NETWORK_FAILURE";
  if (err.isAxiosError && !err.response)                          return "NETWORK_FAILURE";
  if (err.response?.status === 401 || err.response?.status === 403) return "AUTH_FAILURE";
  if (err.response?.status >= 500)                                return "SERVER_ERROR";
  return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Core wrapper: warm check → timeout selection → structured logging
// ---------------------------------------------------------------------------
async function fetchProvider(name, isWarmFn, fn) {
  const { warmMs, coldMs } = PROVIDER_TIMEOUTS[name];
  const warm      = isWarmFn();
  const timeoutMs = warm ? warmMs : coldMs;
  const cacheTag  = warm ? "WARM" : "COLD";

  const t0 = Date.now();

  try {
    const result = await withTimeout(fn, timeoutMs, name);
    console.log(`✅ [${name}] OK — ${Date.now() - t0}ms (${cacheTag})`);
    return result;
  } catch (err) {
    const elapsed  = Date.now() - t0;
    const errType  = classifyError(err);
    const code     = err.code ?? err.cause?.code ?? "N/A";
    const message  = err.message ?? "unknown";

    if (errType === "TIMEOUT" && !warm) {
      // Cold-cache timeout: provider was still warming up. Not a hard failure.
      console.warn(
        `⚠️ [${name}] TIMEOUT (cold-cache warmup) — ${elapsed}ms/${coldMs}ms | cache still building, no data this request`
      );
    } else if (errType === "TIMEOUT") {
      console.error(
        `❌ [${name}] TIMEOUT (warm-cache) — ${elapsed}ms/${warmMs}ms | provider responding slowly`
      );
    } else if (errType === "DNS_FAILURE") {
      console.error(
        `❌ [${name}] DNS_FAILURE — provider unreachable from this environment | code: ENOTFOUND`
      );
    } else if (errType === "NETWORK_FAILURE" || errType === "CONN_REFUSED" || errType === "CONN_RESET") {
      console.error(
        `❌ [${name}] NETWORK_FAILURE — ${errType} | code: ${code} | message: ${message}`
      );
    } else if (errType === "AUTH_FAILURE") {
      console.error(
        `❌ [${name}] AUTH_FAILURE — HTTP ${err.response?.status} | credentials may be expired`
      );
    } else {
      console.error(
        `❌ [${name}] ERROR — ${errType} | ${elapsed}ms | code: ${code} | message: ${message}`
      );
    }

    throw err;
  }
}

// ---------------------------------------------------------------------------
// BUSQUEDA GENERAL: /api/products?q=
// ---------------------------------------------------------------------------
export async function getAllProducts({ q = "" } = {}) {
  const query = String(q || "").trim();

  try {
    console.log(`🔎 Buscando productos: "${query}" ...`);
    const start = Date.now();

    const [elit, masnet, corcisa, nucleo, pcarts, invid] = await Promise.allSettled([
      fetchProvider("Elit",    () => isElitCacheWarm(),         () => fetchProductsFromElit(query)),
      fetchProvider("Masnet",  () => isMasnetCacheWarm(query),  () => fetchProductsFromMasnet(query)),
      fetchProvider("Corcisa", () => isCorcisaCacheWarm(),      () => fetchProductsFromCorcisa(query)),
      fetchProvider("Nucleo",  () => isNucleoCacheWarm(),       () => fetchProductsFromNucleo(query)),
      fetchProvider("PCArts",  () => isPcartsCacheWarm(),       () => fetchProductsFromPcarts(query)),
      fetchProvider("Invid",   () => isInvidCacheWarm(),        () => fetchProductsFromInvid(query)),
    ]);

    const providerMap = { Elit: elit, Masnet: masnet, Corcisa: corcisa, Nucleo: nucleo, PCArts: pcarts, Invid: invid };
    const failed      = Object.entries(providerMap).filter(([, r]) => r.status === "rejected").map(([n]) => n);

    if (failed.length) {
      console.warn(`⚠️ Proveedores no disponibles en esta request: ${failed.join(", ")}`);
    }

    const elitData    = elit.status    === "fulfilled" ? formatElitProducts(elit.value)       : [];
    const masnetData  = masnet.status  === "fulfilled" ? formatMasnetProducts(masnet.value)   : [];
    const corcisaData = corcisa.status === "fulfilled" ? formatCorcisaProducts(corcisa.value) : [];
    const nucleoData  = nucleo.status  === "fulfilled" ? formatNucleoProducts(nucleo.value)   : [];
    const pcartsData  = pcarts.status  === "fulfilled" ? formatPcartsProducts(pcarts.value)   : [];
    const invidData   = invid.status   === "fulfilled" ? formatInvidProducts(invid.value)     : [];

    let allProducts = mergeResults(elitData, masnetData, corcisaData, nucleoData, pcartsData, invidData);
    allProducts = allProducts.map(cleanMergedProduct);

    if (query) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

      allProducts = allProducts.filter((p) => {
        const haystack = `${p.name || ""} ${p.brand || ""} ${p.sku || ""}`.toLowerCase();

        // SKU exacto o parcial (tolerante a separadores: "LT-1000" ≈ "LT1000")
        const skuNorm   = (p.sku || "").toLowerCase().replace(/[\s\-_.]/g, "");
        const queryNorm = query.toLowerCase().replace(/[\s\-_.]/g, "");
        if (!query.includes(" ") && (skuNorm === queryNorm || skuNorm.includes(queryNorm))) return true;

        // Query de 1 término: cualquier match
        if (terms.length === 1) return haystack.includes(terms[0]);

        // Query de 2+ términos: al menos la mitad de los términos debe coincidir.
        // Evita retornar resultados con solo 1 match casual en queries largas.
        const matchCount  = terms.filter((t) => haystack.includes(t)).length;
        const minRequired = Math.ceil(terms.length / 2);
        return matchCount >= minRequired;
      });
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(
      `✅ Búsqueda completada en ${elapsed}s — Total: ${allProducts.length} | OK: ${6 - failed.length}/6 proveedores`
    );

    return allProducts;
  } catch (error) {
    console.error("❌ Error general getAllProducts:", error);
    throw new Error("Error al obtener productos");
  }
}

// ---------------------------------------------------------------------------
// BUSQUEDA EXACTA: /api/products/:sku
// ---------------------------------------------------------------------------
export async function getProductBySku({ sku = "" } = {}) {
  const skuTrim = String(sku || "").trim();
  if (!skuTrim) return [];

  const SKU = skuTrim.toUpperCase();

  try {
    const [elit, masnet, corcisa, nucleo, pcarts, invid] = await Promise.allSettled([
      fetchProvider("Elit",    () => isElitCacheWarm(),         () => fetchProductBySkuFromElit(skuTrim)),
      fetchProvider("Masnet",  () => isMasnetCacheWarm(skuTrim),() => fetchProductBySkuFromMasnet(skuTrim)),
      fetchProvider("Corcisa", () => isCorcisaCacheWarm(),      () => fetchProductsFromCorcisa(skuTrim)),
      fetchProvider("Nucleo",  () => isNucleoCacheWarm(),       () => fetchProductsFromNucleo(skuTrim)),
      fetchProvider("PCArts",  () => isPcartsCacheWarm(),       () => fetchProductBySkuFromPcarts(skuTrim)),
      fetchProvider("Invid",   () => isInvidCacheWarm(),        () => fetchProductBySkuFromInvid(skuTrim)),
    ]);

    const failed = [elit, masnet, corcisa, nucleo, pcarts, invid]
      .map((r, i) => ({ r, name: ["Elit", "Masnet", "Corcisa", "Nucleo", "PCArts", "Invid"][i] }))
      .filter(({ r }) => r.status === "rejected")
      .map(({ name }) => name);

    if (failed.length) {
      console.warn(`⚠️ [SKU ${SKU}] Proveedores no disponibles: ${failed.join(", ")}`);
    }

    const elitData =
      elit.status === "fulfilled" && elit.value ? formatElitProducts([elit.value]) : [];

    const masnetData =
      masnet.status === "fulfilled" && masnet.value ? formatMasnetProducts([masnet.value]) : [];

    const corcisaData =
      corcisa.status === "fulfilled"
        ? formatCorcisaProducts(corcisa.value).filter(
            (p) => String(p.sku || "").trim().toUpperCase() === SKU
          )
        : [];

    const nucleoData =
      nucleo.status === "fulfilled"
        ? formatNucleoProducts(nucleo.value).filter(
            (p) => String(p.sku || "").trim().toUpperCase() === SKU
          )
        : [];

    const pcartsData =
      pcarts.status === "fulfilled" && pcarts.value ? [formatPcartsSingle(pcarts.value)] : [];

    const invidData =
      invid.status === "fulfilled" && invid.value ? formatInvidProducts([invid.value]) : [];

    return mergeResults(elitData, masnetData, corcisaData, nucleoData, pcartsData, invidData).map(
      cleanMergedProduct
    );
  } catch (error) {
    console.error("❌ Error getProductBySku:", error);
    throw new Error("Error al obtener producto por SKU");
  }
}
