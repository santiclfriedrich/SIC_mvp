// web/src/lib/models/masnetModel.js
export function formatMasnetProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts.map((p) => {
    // imagen (puede venir URL o path)
    const firstImg =
      Array.isArray(p.imagenes) && p.imagenes.length > 0 ? p.imagenes[0] : null;

    const image = firstImg
      ? String(firstImg).startsWith("http")
        ? firstImg
        : `https://masnet.com.ar${firstImg}`
      : null;

   

    return {
      sku: p.codigo_producto || p.codigo_alfa || "",
      name: p.nombre || "",
      brand: p.marca || "",
      price: Number(p.precio) || 0,
      iva: p.iva ? `${Number(p.iva)}%` : "21%",
      currency: p.moneda === 1 ? "ARS" : "USD",
      stockLevel: p.nivel_stock || "Sin info",
      stockTotal: Number(p.stock_total) || 0,
      link: p.link || "",
      image,
      provider: "Masnet",
    };
  });
}