export function formatCorcisaProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) {
    console.log("❗ [Corcisa Model] rawProducts NO ES ARRAY:", rawProducts);
    return [];
  }

  console.log("🟣 [Corcisa Model] Recibiendo productos:", rawProducts.length);

  return rawProducts.map((p, idx) => {
    if (!p.codigo_producto && !p.codigo_alfa) {
      console.log("❗ [Corcisa Model] Producto sin SKU, index:", idx, p);
    }

    return {
      sku: p.codigo_producto || p.codigo_alfa || "",
      name: p.nombre || "",
      brand: p.marca || "",
      price: Number(p.precio) || 0,
      iva: p.iva ? `${p.iva}%` : "21%",
      currency: p.moneda === 1 ? "ARS" : "USD",
      stockLevel: p.nivel_stock || "Sin info",
      stockTotal: p.stock_total || 0,
      link: p.link || "",
      image:
        Array.isArray(p.imagenes) && p.imagenes.length > 0
          ? p.imagenes[0]
          : null,
      provider: "Corcisa",
    };
  });
}
