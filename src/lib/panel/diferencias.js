import { SGL_COMPARE_STORAGE } from "@/lib/panel/query";

// Combos/kits: en GBP son UN artículo; en SGL van como componentes sueltos.
// stock SGL del combo = mín(componentes) sets completos; los componentes
// consumidos se descuentan. Clave = código GBP; valor = SKUs en SGL.
export const SGL_COMBOS = {
  IMPHPC1724: ["3PZ75A", "D9P29A", "W9024MC"],
};

async function meta(prisma, key, def = null) {
  const rows = await prisma.$queryRawUnsafe(`SELECT value FROM meta WHERE key = '${key}'`);
  if (!rows.length) return def;
  try { return JSON.parse(rows[0].value); } catch { return def; }
}

/** Filas de Diferencias TML + KPIs (compartido por el JSON y el export). */
export async function diferenciasRows(prisma, { solo = true, q = "", sort = "desvio", dirDesc = true }) {
  const info = await meta(prisma, "sgl_info");
  if (!info) return { info: null, kpi: null, rows: [] };

  const gbpRows = await prisma.$queryRawUnsafe(
    `SELECT UPPER(TRIM(i.item_code)) AS sku, i.item_code, i.item_desc, i.item_id,
            COALESCE(s.fs, 0) AS qty, COALESCE(co.cost, 0) AS cost
       FROM items i
       LEFT JOIN stock s ON s.item_id = i.item_id AND s.stor_id = ${SGL_COMPARE_STORAGE}
       LEFT JOIN costs co ON co.item_id = i.item_id
      WHERE i.disabled = 0 AND i.item_code IS NOT NULL`
  );
  const gbp = {};
  for (const r of gbpRows) {
    gbp[r.sku] = {
      item_code: r.item_code,
      item_desc: r.item_desc,
      item_id: r.item_id != null ? Number(r.item_id) : null,
      qty: Number(r.qty) || 0,
      cost: Number(r.cost) || 0,
    };
  }

  const sglRows = await prisma.$queryRawUnsafe(`SELECT sku, qty, descr FROM sgl_stock`);
  const sgl = {};
  for (const r of sglRows) sgl[r.sku] = { sku: r.sku, qty: Number(r.qty) || 0, descr: r.descr || "" };

  for (const [combo, comps] of Object.entries(SGL_COMBOS)) {
    const ck = combo.trim().toUpperCase();
    const compKeys = comps.map((c) => c.trim().toUpperCase());
    const qtys = compKeys.map((k) => (k in sgl ? sgl[k].qty || 0 : 0));
    const completos = qtys.length ? Math.min(...qtys) : 0;
    if (!(ck in sgl)) sgl[ck] = { sku: combo, qty: 0, descr: "" };
    sgl[ck].qty = completos;
    for (const k of compKeys) if (k in sgl) sgl[k].qty = (sgl[k].qty || 0) - completos;
  }

  const allKeys = new Set([...Object.keys(gbp), ...Object.keys(sgl)]);
  let rows = [];
  for (const sku of allKeys) {
    const g = gbp[sku];
    const s = sgl[sku];
    const gq = g ? g.qty || 0 : 0;
    const sq = s ? s.qty || 0 : 0;
    if (!gq && !sq) continue;
    const diff = gq - sq;
    rows.push({
      sku: (g && g.item_code) || sku,
      item_id: g ? g.item_id : null,
      desc: (g && g.item_desc) || (s && s.descr) || "",
      gbp: gq,
      sgl: sq,
      diff,
      valor_diff: diff * ((g && g.cost) || 0),
      estado: !s ? "solo_gbp" : !g ? "solo_sgl" : diff === 0 ? "ok" : "dif",
    });
  }

  const kpi = {
    comparados: rows.length,
    coinciden: rows.filter((r) => r.estado === "ok").length,
    con_diferencia: rows.filter((r) => r.estado === "dif").length,
    solo_gbp: rows.filter((r) => r.estado === "solo_gbp").length,
    solo_sgl: rows.filter((r) => r.estado === "solo_sgl").length,
    unidades_diff: rows.filter((r) => r.estado !== "ok").reduce((a, r) => a + Math.abs(r.diff), 0),
    valor_diff: rows.filter((r) => r.estado !== "ok").reduce((a, r) => a + Math.abs(r.valor_diff), 0),
  };

  if (solo) rows = rows.filter((r) => r.estado !== "ok");
  if (q) rows = rows.filter((r) => (r.sku || "").toLowerCase().includes(q) || (r.desc || "").toLowerCase().includes(q));

  const keyf =
    { desvio: (r) => Math.abs(r.valor_diff || 0), dif: (r) => r.diff || 0, gbp: (r) => r.gbp || 0, sgl: (r) => r.sgl || 0 }[sort] ||
    ((r) => Math.abs(r.valor_diff || 0));
  rows.sort((a, b) => (dirDesc ? keyf(b) - keyf(a) : keyf(a) - keyf(b)));

  return { info, kpi, rows };
}
