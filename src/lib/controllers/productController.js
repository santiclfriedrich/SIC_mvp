// web/src/lib/controllers/productController.js

import { mergeResults } from "@/lib/utils/mergeResults";
import { cleanMergedProduct } from "@/lib/utils/cleanMergedProduct";


// Services (los fetch a proveedores)
import { fetchProductsFromElit, fetchProductBySkuFromElit } from "@/lib/services/elitAPI";
import { fetchProductsFromMasnet } from "@/lib/services/masnetAPI";
import { fetchProductsFromCorcisa } from "@/lib/services/corcisaAPI";
import { fetchProductsFromNucleo } from "@/lib/services/nucleoAPI";
import { fetchProductsFromPcarts, fetchProductBySkuFromPcarts } from "@/lib/services/pcartsAPI";

// Models (normalizadores)
import {
  formatElitProducts,
  formatMasnetProducts,
  formatCorcisaProducts,
  formatNucleoProducts,
  formatPcartsProducts,
  formatPcartsSingle,
} from "@/lib/models";

/**
 * BUSQUEDA GENERAL: /api/products?q=
 * Devuelve: Array (unificado)
 */
export async function getAllProducts({ q = "" } = {}) {
  const query = String(q || "").trim();

  try {
    console.log(`🔎 Buscando productos: "${query}" ...`);
    const start = Date.now();

    const [elit, masnet, corcisa, nucleo, pcarts] = await Promise.allSettled([
      fetchProductsFromElit(query),
      fetchProductsFromMasnet(query),
      fetchProductsFromCorcisa(query),
      fetchProductsFromNucleo(query),
      fetchProductsFromPcarts(query),
    ]);

    const elitData = elit.status === "fulfilled" ? formatElitProducts(elit.value) : [];
    const masnetData = masnet.status === "fulfilled" ? formatMasnetProducts(masnet.value) : [];
    const corcisaData = corcisa.status === "fulfilled" ? formatCorcisaProducts(corcisa.value) : [];
    const nucleoData = nucleo.status === "fulfilled" ? formatNucleoProducts(nucleo.value) : [];
    const pcartsData = pcarts.status === "fulfilled" ? formatPcartsProducts(pcarts.value) : [];

    let allProducts = mergeResults(elitData, masnetData, corcisaData, nucleoData, pcartsData);
    allProducts = allProducts.map(cleanMergedProduct);

    // Filtro flexible por palabras (igual que tu Express)
    if (query) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

      allProducts = allProducts.filter((p) => {
        const haystack = `${p.name || ""} ${p.brand || ""} ${p.sku || ""}`.toLowerCase();

        // si es SKU exacto → match directo
        if (terms.length === 1 && p.sku?.toLowerCase() === terms[0]) return true;

        // al menos UNA palabra debe coincidir
        return terms.some((term) => haystack.includes(term));
      });
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`✅ Búsqueda completada en ${elapsed}s — Total: ${allProducts.length}`);

    return allProducts;
  } catch (error) {
    console.error("❌ Error general getAllProducts:", error);
    // En Next, lo más limpio: lanzar y que el route devuelva 500
    throw new Error("Error al obtener productos");
  }
}

/**
 * BUSQUEDA EXACTA: /api/products/:sku
 * Devuelve: Array (unificado)
 */
export async function getProductBySku({ sku = "" } = {}) {
  const skuTrim = String(sku || "").trim();
  if (!skuTrim) return [];

  try {
    const [elit, masnet, corcisa, nucleo, pcarts] = await Promise.allSettled([
      fetchProductBySkuFromElit(skuTrim),
      fetchProductsFromMasnet(skuTrim),
      fetchProductsFromCorcisa(skuTrim),
      fetchProductsFromNucleo(skuTrim),
      fetchProductBySkuFromPcarts(skuTrim),
    ]);

    const elitData =
      elit.status === "fulfilled" && elit.value ? formatElitProducts([elit.value]) : [];

    const masnetData =
      masnet.status === "fulfilled"
        ? formatMasnetProducts(masnet.value).filter((p) => String(p.sku) === skuTrim)
        : [];

    const corcisaData =
      corcisa.status === "fulfilled"
        ? formatCorcisaProducts(corcisa.value).filter((p) => String(p.sku) === skuTrim)
        : [];

    const nucleoData =
      nucleo.status === "fulfilled"
        ? formatNucleoProducts(nucleo.value).filter((p) => String(p.sku) === skuTrim)
        : [];

    const pcartsData =
      pcarts.status === "fulfilled" && pcarts.value ? [formatPcartsSingle(pcarts.value)] : [];

    const finalResults = mergeResults(elitData, masnetData, corcisaData, nucleoData, pcartsData)
    .map(cleanMergedProduct);
    
    return finalResults;
  } catch (error) {
    console.error("❌ Error getProductBySku:", error);
    throw new Error("Error al obtener producto por SKU");
  }
}
