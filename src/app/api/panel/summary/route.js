import { prisma } from "@/lib/prisma";
import { VIS, priceSource, normPrli, jsonSafe } from "@/lib/panel/query";

export const dynamic = "force-dynamic";

async function meta(key, def) {
  const rows = await prisma.$queryRawUnsafe(`SELECT value FROM meta WHERE key = '${key}'`);
  if (!rows.length) return def;
  try { return JSON.parse(rows[0].value); } catch { return def; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const prli = normPrli(searchParams.get("prli"));
  const { pjoin, price, curr } = priceSource(prli);
  const { pjoin: pjoinS, price: priceS } = priceSource(prli, "s.item_id");
  const q = (sql) => prisma.$queryRawUnsafe(sql);

  try {
    const [kpi] = await q(
      `SELECT COUNT(*) AS skus_total,
              SUM(CASE WHEN stock_total > 0 THEN 1 ELSE 0 END) AS skus_con_stock,
              SUM(CASE WHEN stock_total <= 0 THEN 1 ELSE 0 END) AS skus_sin_stock,
              SUM(CASE WHEN stock_total > 0 THEN stock_total ELSE 0 END) AS unidades
       FROM items WHERE disabled = 0`
    );
    const value_by_currency = await q(
      `SELECT ${curr} AS curr, SUM(i.stock_total * ${price}) AS valor, COUNT(*) AS articulos
       FROM items i ${pjoin}
       WHERE i.disabled = 0 AND i.stock_total > 0 AND ${price} > 0
       GROUP BY curr ORDER BY valor DESC`
    );
    const by_category = await q(
      `SELECT COALESCE(c.cat_desc, 'Sin categoría') AS label,
              SUM(i.stock_total) AS unidades,
              SUM(i.stock_total * COALESCE(${price}, 0)) AS valor,
              COUNT(*) AS skus
       FROM items i LEFT JOIN categories c ON c.cat_id = i.cat_id ${pjoin}
       WHERE i.disabled = 0 AND i.stock_total > 0
       GROUP BY label ORDER BY valor DESC LIMIT 12`
    );
    const by_storage = await q(
      `SELECT st.stor_id, st.stor_name AS label,
              SUM(s.fs) AS unidades, SUM(s.ps) AS disponibles,
              COUNT(DISTINCT CASE WHEN s.fs > 0 THEN s.item_id END) AS skus,
              SUM(s.fs * COALESCE(${priceS}, 0)) AS valor
       FROM stock s
       JOIN items i ON i.item_id = s.item_id AND i.disabled = 0
       JOIN storages st ON st.stor_id = s.stor_id
       ${pjoinS}
       WHERE s.fs > 0 AND s.stor_id IN (${VIS})
       GROUP BY st.stor_id ORDER BY valor DESC`
    );
    const by_brand = await q(
      `SELECT COALESCE(b.brand_desc, 'Sin marca') AS label,
              SUM(i.stock_total) AS unidades,
              SUM(i.stock_total * COALESCE(${price}, 0)) AS valor
       FROM items i LEFT JOIN brands b ON b.brand_id = i.brand_id ${pjoin}
       WHERE i.disabled = 0 AND i.stock_total > 0
       GROUP BY label ORDER BY valor DESC LIMIT 10`
    );
    const top_items = await q(
      `SELECT i.item_code, i.item_desc, i.stock_total AS unidades,
              ${price} AS price, ${curr} AS curr, i.stock_total * ${price} AS valor
       FROM items i ${pjoin}
       WHERE i.disabled = 0 AND i.stock_total > 0 AND ${price} > 0
       ORDER BY valor DESC LIMIT 10`
    );
    const [sp] = await q(
      `SELECT COUNT(*) AS c FROM items i ${pjoin}
       WHERE i.disabled = 0 AND i.stock_total > 0 AND COALESCE(${price}, 0) <= 0`
    );

    return Response.json(
      jsonSafe({
        kpi,
        cotizacion: await meta("cotizacion", 1510),
        value_by_currency,
        by_category,
        by_storage,
        by_brand,
        top_items,
        sin_precio: Number(sp?.c ?? 0),
        last_sync: await meta("last_sync", null),
      })
    );
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
