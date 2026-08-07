import { VIS, priceSource, normPrli } from "@/lib/panel/query";

function normInt(v) {
  const n = parseInt(v ?? "", 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
const STOCK_MODES = ["con", "sin", "neg", "sincosto", "todos"];
const SORT_KEYS = ["codigo", "desc", "stock", "precio", "valor"];

// Reproduce _items_sql() de app.py. `q` (texto del usuario) va parametrizado ($1);
// el resto son enteros/enums validados que se interpolan seguros.
export function buildItemsSql(sp) {
  const prli = normPrli(sp.get("prli"));
  const qStr = (sp.get("q") || "").trim();
  const cat = normInt(sp.get("cat"));
  const brand = normInt(sp.get("brand"));
  const stor = normInt(sp.get("stor"));
  const stock = STOCK_MODES.includes(sp.get("stock")) ? sp.get("stock") : "con";
  const sort = SORT_KEYS.includes(sp.get("sort")) ? sp.get("sort") : "valor";
  const dir = sp.get("dir") === "asc" ? "ASC" : "DESC";

  const { pjoin, price, curr } = priceSource(prli);
  const where = ["i.disabled = 0"];
  const params = [];
  if (qStr) {
    params.push(`%${qStr.toLowerCase()}%`);
    where.push("(LOWER(i.item_code) LIKE $1 OR LOWER(i.item_desc) LIKE $1 OR LOWER(i.vendor_code) LIKE $1)");
  }
  if (cat) where.push(`i.cat_id = ${cat}`);
  if (brand) where.push(`i.brand_id = ${brand}`);

  let stockExpr, dispExpr, joinStock;
  if (stor) {
    stockExpr = "COALESCE(s.fs, 0)";
    dispExpr = "COALESCE(s.ps, 0)";
    joinStock = `LEFT JOIN stock s ON s.item_id = i.item_id AND s.stor_id = ${stor}`;
  } else {
    stockExpr = "i.stock_total";
    dispExpr = "COALESCE(sv.ps, 0)";
    joinStock = `LEFT JOIN (SELECT item_id, SUM(ps) AS ps FROM stock WHERE stor_id IN (${VIS}) GROUP BY item_id) sv ON sv.item_id = i.item_id`;
  }

  if (stock === "con") where.push(`${stockExpr} > 0`);
  else if (stock === "sin") where.push(`${stockExpr} <= 0`);
  else if (stock === "neg") where.push(`${stockExpr} < 0`);
  else if (stock === "sincosto") {
    where.push(`${stockExpr} > 0`);
    where.push("NOT EXISTS (SELECT 1 FROM costs cx WHERE cx.item_id = i.item_id AND cx.cost > 0)");
  }

  const sortMap = { codigo: "i.item_code", desc: "i.item_desc", stock: "unidades", precio: price, valor: "valor" };
  const sortSql = sortMap[sort] || "valor";

  const sqlBase = `FROM items i ${joinStock} ${pjoin} LEFT JOIN categories c ON c.cat_id = i.cat_id LEFT JOIN brands b ON b.brand_id = i.brand_id WHERE ${where.join(" AND ")}`;
  const selectSql = `SELECT i.item_id, i.item_code, i.item_desc, i.vendor_code, c.cat_desc, b.brand_desc, ${stockExpr} AS unidades, ${dispExpr} AS disponibles, ${price} AS price, ${curr} AS curr, ${stockExpr} * COALESCE(${price}, 0) AS valor ${sqlBase} ORDER BY ${sortSql} ${dir}, i.item_code`;
  const countSql = `SELECT COUNT(*) AS c ${sqlBase}`;
  return { selectSql, countSql, params, prli, esCosto: prli === 0 };
}
