"use client";
import { useEffect, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Card } from "@/components/panel/Card";
import { fmtMoney, fmtQty } from "@/lib/panel/format";

const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money2 = (v) => "$ " + nf2.format(Number(v) || 0);
const tc2 = (v) => (v == null ? "—" : nf2.format(Number(v)));

export function VentasDetalleTabla({ desde, hasta, canal, sucursal }) {
  const qs = new URLSearchParams({ desde, hasta });
  if (canal) qs.set("canal", canal);
  if (sucursal) qs.set("sucursal", sucursal);
  const qsStr = qs.toString();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetch(`/api/panel/ventas/detalle?${qsStr}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (!cancel) { setData(j); setLoading(false); } })
      .catch(() => { if (!cancel) { setData(null); setLoading(false); } });
    return () => { cancel = true; };
  }, [qsStr]);

  const th = "px-2.5 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-ink-400 whitespace-nowrap";
  const td = "px-2.5 py-2 text-slate-700 dark:text-ink-200 whitespace-nowrap";

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-ink-300">
          {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
          {data ? (
            <span>
              <b className="font-semibold text-slate-800 dark:text-ink-100">{fmtQty(data.total)}</b> líneas ·{" "}
              <b className="font-semibold text-slate-800 dark:text-ink-100">{fmtMoney(data.facturado, "ARS")}</b> facturado
            </span>
          ) : (
            <span>Cargando detalle…</span>
          )}
        </div>
        <a href={`/api/panel/ventas/detalle.xlsx?${qsStr}`} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/70">
          <FileDown size={15} />
          Excel
        </a>
      </div>

      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full min-w-[1600px] text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_#e2e8f0] dark:bg-ink-900 dark:shadow-[inset_0_-1px_0_#343230]">
            <tr>
              <th className={`${th} text-left`}>Fecha</th>
              <th className={`${th} text-left`}>Comprobante</th>
              <th className={`${th} text-left`}>Cliente</th>
              <th className={`${th} text-left`}>Condición</th>
              <th className={`${th} text-left`}>Vendedor</th>
              <th className={`${th} text-left`}>Sucursal</th>
              <th className={`${th} text-left`}>SKU</th>
              <th className={`${th} text-left`}>Artículo</th>
              <th className={`${th} text-left`}>Marca</th>
              <th className={`${th} text-left`}>Categoría</th>
              <th className={`${th} text-right`}>Cant.</th>
              <th className={`${th} text-right`}>P. Unit. c/IVA</th>
              <th className={`${th} text-right`}>P. Unit. neto</th>
              <th className={`${th} text-right`}>Neto</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={`${th} text-right`}>TC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-ink-800">
            {data?.rows?.length ? (
              data.rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-ink-800/60">
                  <td className={`${td} text-left tabular-nums`}>{r.fecha}</td>
                  <td className={`${td} text-left`}>
                    <span className="font-medium">{r.comprobante}</span>
                    {r.tipo === "NC" && <span className="ml-1 rounded bg-red-50 px-1 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-400">NC</span>}
                    {r.tipo === "ND" && <span className="ml-1 rounded bg-amber-50 px-1 text-xs font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">ND</span>}
                  </td>
                  <td className={`${td} text-left`}>
                    {r.cliente}
                    {r.clase_cliente && <div className="text-xs text-slate-400 dark:text-ink-500">{r.clase_cliente}</div>}
                  </td>
                  <td className={`${td} text-left text-xs text-slate-500 dark:text-ink-400`}>{r.condicion || "—"}</td>
                  <td className={`${td} text-left`}>{r.vendedor || "—"}</td>
                  <td className={`${td} text-left`}>{r.sucursal || "—"}</td>
                  <td className={`${td} text-left font-mono text-[13px]`}>{r.item_code}</td>
                  <td className={`${td} max-w-xs truncate text-left`} title={r.item_desc}>{r.item_desc}</td>
                  <td className={`${td} text-left text-xs text-slate-500 dark:text-ink-400`}>{r.marca || "—"}</td>
                  <td className={`${td} text-left text-xs text-slate-500 dark:text-ink-400`}>{r.categoria || "—"}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtQty(r.cantidad)}</td>
                  <td className={`${td} text-right tabular-nums`}>{money2(r.cantidad ? r.total / r.cantidad : 0)}</td>
                  <td className={`${td} text-right tabular-nums`}>{money2(r.cantidad ? r.neto / r.cantidad : 0)}</td>
                  <td className={`${td} text-right tabular-nums`}>{money2(r.neto)}</td>
                  <td className={`px-2.5 py-2 text-right font-medium tabular-nums whitespace-nowrap ${Number(r.total) < 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-ink-100"}`}>{money2(r.total)}</td>
                  <td className={`${td} text-right tabular-nums text-slate-500 dark:text-ink-400`}>{tc2(r.tc)}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={16} className="py-12 text-center text-sm text-slate-400 dark:text-ink-500">{loading ? "Cargando…" : "Sin ventas en el rango elegido."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 1000 && (
        <p className="mt-3 text-xs text-slate-400 dark:text-ink-500">Mostrando las primeras 1.000 líneas. Descargá el Excel para el detalle completo.</p>
      )}
    </Card>
  );
}
