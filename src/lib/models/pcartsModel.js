// web/src/lib/models/pcartsModel.js

export function formatPcartsProducts(rawProducts = []) {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts.map((p) => {
    const stock = Number(p?.stock) || 0;

    return {
      sku: p?.sku || "",
      name: p?.sku_desc || "",
      brand: p?.brand_desc || p?.brand || "",
      price: Number(p?.price) || 0,
      iva: p?.tax_iva_rate ? `${p.tax_iva_rate}%` : "21%",
      currency: "USD",
      stockLevel: stock > 10 ? "alto" : stock > 0 ? "bajo" : "sin stock",
      stockTotal: stock,
      link: "",
      image: Array.isArray(p?.images) && p.images.length > 0 ? p.images[0] : null,
      provider: "PCArts",
    };
  });
}

export function formatPcartsSingle(p) {
  if (!p) return null;

  const stock = Number(p?.stock) || 0;

  return {
    sku: p?.sku || "",
    name: p?.sku_desc || "",
    brand: p?.brand_desc || p?.brand || "",
    price: Number(p?.price) || 0,
    iva: p?.tax_iva_rate ? `${p.tax_iva_rate}%` : "21%",
    currency: "USD",
    stockLevel: stock > 10 ? "alto" : stock > 0 ? "bajo" : "sin stock",
    stockTotal: stock,
    link: "",
    image: Array.isArray(p?.images) && p.images.length > 0 ? p.images[0] : null,
    provider: "PCArts",
  };
}
