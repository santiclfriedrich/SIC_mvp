// web/src/lib/models/distecnaModel.js
//
// Normaliza productos de Distecna al esquema unificado.
// Campos del catálogo: code, sku, stock, currency, price, iva, iib
// Campos del detalle:  name, brand, subBrand, category, description,
//                      fullDescription, attributes, images, ean, upc
//
// Nota: el catálogo básico no incluye name/brand/images.
// Si el item fue enriquecido con el detalle (via fetchProductBySkuFromDistecna),
// los campos extras estarán disponibles.

export function formatDistecnaProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts
    .map((p) => {
      const sku = String(p.sku ?? p.code ?? "").trim();
      if (!sku) return null;

      const price    = parseFloat(p.price) || 0;
      const ivaNum   = parseFloat(p.iva)   || 0;
      const iva      = ivaNum > 0 ? `${Math.round(ivaNum * 100)}%` : "21%";
      const stock    = parseInt(p.stock, 10) || 0;

      // "USS" en la API parece ser USD
      const rawCurrency = String(p.currency ?? "").toUpperCase();
      const currency    = rawCurrency === "USS" || rawCurrency === "USD" ? "USD" : "ARS";

      // Imagen: puede venir del detalle como array o string.
      // null cuando no hay imagen — SmartImage no renderiza con src vacío.
      let image = null;
      if (Array.isArray(p.images) && p.images.length) {
        const first = String(p.images[0]).trim();
        if (first) image = first;
      } else if (typeof p.images === "string" && p.images.trim()) {
        image = p.images.trim();
      }

      return {
        sku,
        name:       String(p.name ?? p.description ?? "").trim() || sku,
        brand:      String(p.brand ?? p.subBrand ?? "").trim(),
        price,
        iva,
        currency,
        stockLevel: stock > 20 ? "disponible" : stock > 0 ? "limitado" : "sin stock",
        stockTotal: stock,
        link:       "",
        image,
        provider:   "Distecna",
      };
    })
    .filter(Boolean);
}
