// src/utils/mergeResults.js

export function mergeResults(...lists) {
  const skuMap = {};

  for (const list of lists) {
    if (!Array.isArray(list)) continue;

    for (const p of list) {
      if (!p?.sku) continue;

      const sku = String(p.sku).trim().toUpperCase();

      if (!skuMap[sku]) {
        skuMap[sku] = {
          sku,
          name: p.name,
          brand: p.brand,
          image: p.image,
          description: p.description,
          providers: [],
        };
      }

      skuMap[sku].providers.push({
        provider: p.provider,
        price: Number(p.price) || 0,
        currency: p.currency,
        iva: p.iva,
        stockTotal: p.stockTotal ?? p.stock ?? 0,
        link: p.link,
      });
    }
  }

  return Object.values(skuMap).map((item) => {
    // 🔹 Si hay un solo proveedor → compatibilidad hacia atrás
    if (item.providers.length === 1) {
      const p = item.providers[0];
      return {
        ...item,
        ...p,
      };
    }

    // 🔹 Si hay varios → comparar precios
    const best = [...item.providers].sort(
      (a, b) => a.price - b.price
    )[0];

    return {
      ...item,
      providers: item.providers,
      bestPrice: best,
      price: best.price,
      currency: best.currency,
      iva: best.iva,
      stockTotal: best.stockTotal,
      link: best.link,
      provider: best.provider,
    };
  });
}
