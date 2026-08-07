import { prisma } from "@/lib/prisma";
import { VIS, STOR_ORDER, SGL_COMPARE_STORAGE, jsonSafe } from "@/lib/panel/query";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function meta(key, def = null) {
  const rows = await prisma.$queryRawUnsafe(`SELECT value FROM meta WHERE key = '${key}'`);
  if (!rows.length) return def;
  try { return JSON.parse(rows[0].value); } catch { return def; }
}
const num = (x) => (x == null ? null : Number(x));
const gfmt = (n) => String(Number(n)); // equivalente a Python {:g}

export async function GET(_request, { params }) {
  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (!Number.isInteger(itemId)) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }
  try {
    const itemRows = await prisma.$queryRawUnsafe(
      `SELECT i.*, c.cat_desc, b.brand_desc
         FROM items i
         LEFT JOIN categories c ON c.cat_id = i.cat_id
         LEFT JOIN brands b ON b.brand_id = i.brand_id
        WHERE i.item_id = ${itemId}`
    );
    if (!itemRows.length) return Response.json({ error: "no existe" }, { status: 404 });
    const item = itemRows[0];

    // todos los depósitos visibles, aunque estén en 0, en el orden del panel
    const storages = await prisma.$queryRawUnsafe(
      `SELECT st.stor_id, st.stor_name,
              COALESCE(s.fs, 0) AS fs,
              CASE WHEN s.item_id IS NULL THEN 0 ELSE s.ps END AS ps
         FROM storages st
         LEFT JOIN stock s ON s.item_id = ${itemId} AND s.stor_id = st.stor_id
        WHERE st.stor_id IN (${VIS})
        ORDER BY ${STOR_ORDER}`
    );

    // fila "Sincro SGL" después de TML (stor 19), solo si hay snapshot SGL
    const sglInfo = await meta("sgl_info");
    if (sglInfo) {
      const sku = (item.item_code || "").trim().toUpperCase();
      let sglRow = [];
      try {
        sglRow = await prisma.$queryRawUnsafe(`SELECT qty FROM sgl_stock WHERE sku = $1`, sku);
      } catch { sglRow = []; }
      const filaSgl = {
        stor_name: "Sincro SGL",
        fs: sglRow.length ? num(sglRow[0].qty) : 0,
        ps: null,
        sgl: true,
      };
      let pos = storages.findIndex((s) => Number(s.stor_id) === SGL_COMPARE_STORAGE);
      pos = pos === -1 ? storages.length : pos + 1;
      storages.splice(pos, 0, filaSgl);
    }

    const prices = await prisma.$queryRawUnsafe(
      `SELECT pl.prli_desc, p.price, cu.curr_symbol AS curr
         FROM prices p
         JOIN price_lists pl ON pl.prli_id = p.prli_id
         LEFT JOIN currencies cu ON cu.curr_id = p.curr_id
        WHERE p.item_id = ${itemId} AND p.price > 0
        ORDER BY p.prli_id`
    );

    // Costo cacheado. NOTA: bi-stock (Python) consulta el costo en vivo al ERP
    // cuando no hay cache; eso no existe en Next, así que solo usamos costs.
    const costRows = await prisma.$queryRawUnsafe(
      `SELECT cost, cost_ppp, cost_curr, cost_orig FROM costs WHERE item_id = ${itemId}`
    );
    const cost = costRows[0];
    const costValue = cost ? cost.cost : null;
    if (costValue) {
      const cotiz = await meta("cotizacion", 1510);
      if (cost.cost_curr === "USD" && cost.cost_orig) {
        prices.unshift({ prli_desc: `Costo en ARS · dólar GBP ${gfmt(cotiz)}`, price: num(costValue), curr: "ARS" });
        prices.unshift({ prli_desc: "Costo — 01-Lista de Costos", price: num(cost.cost_orig), curr: "USD" });
      } else {
        prices.unshift({ prli_desc: "Costo — 01-Lista de Costos", price: num(costValue), curr: "ARS" });
      }
    }

    return Response.json(jsonSafe({ item, storages, prices }));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
