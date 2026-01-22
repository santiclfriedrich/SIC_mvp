export function cleanMergedProduct(p) {
  if (!p || typeof p !== "object") return p;

  // Mantener providers y eliminar campos planos duplicados
  const cleaned = { ...p };

  delete cleaned.provider;
  delete cleaned.price;
  delete cleaned.currency;
  delete cleaned.iva;
  delete cleaned.stockTotal;
  delete cleaned.link;
  delete cleaned.stockLevel;

  return cleaned;
}
