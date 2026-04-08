// web/src/lib/models/microglobalModel.js
//
// Normaliza productos de la API SOAP de Microglobal al esquema unificado.
// Campos: partNumber, descripcion, precio, stock, iva_pct, partNumber_ori,
//         upc, codCategoria, categoria, codMarca, marca, bundle,
//         peso, ancho, alto, profundidad, ii_pct

export function formatMicroglobalProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts
    .map((p) => {
      const sku = String(p.partNumber ?? p.partNumber_ori ?? "").trim();
      if (!sku) return null;

      const price  = parseFloat(p.precio)  || 0;
      const ivaNum = parseFloat(p.iva_pct) || 0;
      const iva    = ivaNum > 0 ? `${ivaNum}%` : "21%";
      const stock  = parseInt(p.stock, 10) || 0;

      return {
        sku,
        name:       String(p.descripcion ?? "").trim(),
        brand:      String(p.marca ?? "").trim(),
        price,
        iva,
        currency:   "ARS",
        stockLevel: stock > 20 ? "disponible" : stock > 0 ? "limitado" : "sin stock",
        stockTotal: stock,
        link:       "",
        image:      "/microg.jpg",
        provider:   "Microglobal",
      };
    })
    .filter(Boolean);
}
