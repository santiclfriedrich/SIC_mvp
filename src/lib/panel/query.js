// Helpers de consulta del panel BI (portados de app.py).
export const VIS = "1,19,17,31,30";
export const SGL_COMPARE_STORAGE = 19;
// Orden de visualización de depósitos = config.VISIBLE_STORAGES [1,19,17,31,30].
export const STOR_ORDER =
  "CASE st.stor_id WHEN 1 THEN 0 WHEN 19 THEN 1 WHEN 17 THEN 2 WHEN 31 THEN 3 WHEN 30 THEN 4 ELSE 999 END";

export function normPrli(v) {
  const n = parseInt(v ?? "0", 10);
  return [0, 1, 9].includes(n) ? n : 0;
}

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

export function jsonSafe(x) {
  return JSON.parse(JSON.stringify(x, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
}
