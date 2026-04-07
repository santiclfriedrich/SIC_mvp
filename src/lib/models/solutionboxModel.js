// web/src/lib/models/solutionboxModel.js
//
// Normaliza productos de la API de SolutionBox al esquema unificado.
// Campos: Alias, Numero_de_Parte, Descripcion, Detalle, Precio, Moneda,
//         Cotizacion, Tasa_IVA, Tasa_Impuestos_Internos, Stock, Marca, Categorias

export function formatSolutionboxProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts
    .map((p) => {
      const sku = String(p.Numero_de_Parte ?? p.Alias ?? "").trim();
      if (!sku) return null;

      const price    = parseFloat(p.Precio) || 0;
      const ivaNum   = parseFloat(p.Tasa_IVA) || 0;
      const iva      = ivaNum > 0 ? `${ivaNum}%` : "21%";
      const currency = String(p.Moneda ?? "ARS").trim().toUpperCase();
      const stock    = parseInt(p.Stock, 10) || 0;

      return {
        sku,
        name:       String(p.Descripcion ?? "").trim(),
        brand:      String(p.Marca ?? "").trim(),
        price,
        iva,
        currency,
        stockLevel: stock > 20 ? "disponible" : stock > 0 ? "limitado" : "sin stock",
        stockTotal: stock,
        link:       "",
        image:      "/sbox.png",
        provider:   "SolutionBox",
      };
    })
    .filter(Boolean);
}
