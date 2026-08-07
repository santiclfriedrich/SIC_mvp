import { prisma } from "@/lib/prisma";
import { VIS, jsonSafe } from "@/lib/panel/query";

export const dynamic = "force-dynamic";

export async function GET() {
  const q = (sql) => prisma.$queryRawUnsafe(sql);
  try {
    const categories = await q(
      `SELECT c.cat_id, c.cat_desc FROM categories c
       WHERE EXISTS (SELECT 1 FROM items i WHERE i.cat_id = c.cat_id AND i.disabled = 0)
       ORDER BY c.cat_desc`
    );
    const brands = await q(
      `SELECT b.brand_id, b.brand_desc FROM brands b
       WHERE EXISTS (SELECT 1 FROM items i WHERE i.brand_id = b.brand_id AND i.disabled = 0)
       ORDER BY b.brand_desc`
    );
    const storages = await q(`SELECT stor_id, stor_name FROM storages WHERE stor_id IN (${VIS}) ORDER BY stor_id`);
    const currencies = await q(`SELECT curr_id, curr_desc, curr_symbol FROM currencies`);
    const hasCosts = await q(`SELECT 1 AS x FROM costs LIMIT 1`);
    const priceListRows = await q(`SELECT prli_id, prli_desc FROM price_lists WHERE prli_id IN (1, 9) ORDER BY prli_id`);
    const price_lists = [
      ...(hasCosts.length ? [{ prli_id: 0, prli_desc: "Costo — 01-Lista de Costos" }] : []),
      ...priceListRows,
    ];
    return Response.json(jsonSafe({ categories, brands, storages, currencies, price_lists }));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
