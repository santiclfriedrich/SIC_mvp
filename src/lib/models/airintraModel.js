// web/src/lib/models/airintraModel.js
//
// Normaliza productos de AirIntra al esquema unificado.
// Stock = suma de disponible en todas las sucursales (ros + mza + cba + lug + air).
// Moneda "DOL" = USD.

function calcStockTotal(p) {
  return (
    (p.ros?.disponible ?? 0) +
    (p.mza?.disponible ?? 0) +
    (p.cba?.disponible ?? 0) +
    (p.lug?.disponible ?? 0) +
    (p.air?.disponible ?? 0)
  );
}

function stockLevel(total) {
  if (total <= 0)  return "sin stock";
  if (total <= 10) return "limitado";
  return "disponible";
}

export function formatAirIntraProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts
    .map((p) => {
      const sku = String(p.part_number ?? "").trim();
      if (!sku) return null;

      const stockTotal = calcStockTotal(p);
      const ivaNum     = parseFloat(p.impuesto_iva?.alicuota) || 21;
      const currency   = String(p.moneda ?? "DOL").toUpperCase() === "DOL" ? "USD" : "ARS";

      return {
        sku,
        name:       String(p.descrip ?? "").trim(),
        brand:      "",
        price:      parseFloat(p.precio) || 0,
        iva:        `${ivaNum}%`,
        currency,
        stockLevel: stockLevel(stockTotal),
        stockTotal,
        link:       "",
        image:      null,
        provider:   "AirIntra",
      };
    })
    .filter(Boolean);
}
