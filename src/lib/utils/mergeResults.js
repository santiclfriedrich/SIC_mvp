// src/utils/mergeResults.js

/**
 * Normalizes a SKU for comparison purposes only.
 * Removes separators (spaces, hyphens, underscores, dots) and uppercases.
 * The original SKU is preserved for display.
 *
 * Examples:
 *   "LT-1000" → "LT1000"
 *   "lm-gen5 ii" → "LMGEN5II"
 *   "ABC_123.4" → "ABC1234"
 */
function normalizeSku(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-_\.]/g, "");
}

export function mergeResults(...lists) {
  const skuMap = {};          // normalizedSku → merged entry
  const canonicalSku = {};    // normalizedSku → first-seen display SKU

  for (const list of lists) {
    if (!Array.isArray(list)) continue;

    for (const p of list) {
      if (!p?.sku) continue;

      const displaySku    = String(p.sku).trim().toUpperCase();
      const normalizedSku = normalizeSku(p.sku);

      // First provider for this normalized SKU wins the display SKU
      if (!canonicalSku[normalizedSku]) {
        canonicalSku[normalizedSku] = displaySku;
      }

      if (!skuMap[normalizedSku]) {
        skuMap[normalizedSku] = {
          sku:         canonicalSku[normalizedSku],
          name:        p.name,
          brand:       p.brand,
          image:       p.image,
          description: p.description,
          providers:   [],
        };
      }

      // Fill in missing top-level fields from later providers
      if (!skuMap[normalizedSku].name  && p.name)  skuMap[normalizedSku].name  = p.name;
      if (!skuMap[normalizedSku].brand && p.brand) skuMap[normalizedSku].brand = p.brand;
      if (!skuMap[normalizedSku].image && p.image) skuMap[normalizedSku].image = p.image;

      skuMap[normalizedSku].providers.push({
        provider:   p.provider,
        price:      Number(p.price) || 0,
        currency:   p.currency,
        iva:        p.iva,
        stockTotal: p.stockTotal ?? p.stock ?? 0,
        link:       p.link,
        image:      p.image ?? null,
      });
    }
  }

  return Object.values(skuMap).map((item) => {
    // Single provider → flatten for backwards compatibility
    if (item.providers.length === 1) {
      const p = item.providers[0];
      return { ...item, ...p };
    }

    // Multiple providers → sort by price, expose bestPrice
    const sorted = [...item.providers].sort((a, b) => a.price - b.price);
    const best   = sorted[0];

    return {
      ...item,
      providers:  item.providers,
      bestPrice:  best,
      price:      best.price,
      currency:   best.currency,
      iva:        best.iva,
      stockTotal: best.stockTotal,
      link:       best.link,
      provider:   best.provider,
    };
  });
}
