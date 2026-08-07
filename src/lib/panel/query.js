// Helpers de consulta del panel BI (portados de app.py: VIS + _price_source).
// La DB unificada ya tiene las tablas del panel (items, stock, costs, etc.).

// Depósitos visibles, en orden (config.VISIBLE_STORAGES = [1,19,17,31,30]).
export const VIS = "1,19,17,31,30";

// prli permitidos: 0 = costo (01-Lista de Costos); 1 y 9 = listas sincronizadas.
export function normPrli(v) {
  const n = parseInt(v ?? "0", 10);
  return [0, 1, 9].includes(n) ? n : 0;
}

// Fragmentos SQL de la fuente de valorización (prli validado como entero → se
// interpola seguro). prli = 0 -> costo (ARS); otro -> lista de precios.
export function priceSource(prli, itemCol = "i.item_id") {
  if (prli === 0) {
    return { pjoin: `LEFT JOIN costs p ON p.item_id = ${itemCol}`, price: "p.cost", curr: "'ARS'" };
  }
  return {
    pjoin: `LEFT JOIN prices p ON p.item_id = ${itemCol} AND p.prli_id = ${prli} LEFT JOIN currencies cu ON cu.curr_id = p.curr_id`,
    price: "p.price",
    curr: "COALESCE(cu.curr_symbol, 'ARS')",
  };
}

// $queryRaw devuelve COUNT/bigint como BigInt (no serializable a JSON).
export function jsonSafe(x) {
  return JSON.parse(JSON.stringify(x, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
}
