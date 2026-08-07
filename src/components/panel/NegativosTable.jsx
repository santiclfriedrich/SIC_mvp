"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fmt } from "@/lib/panel/compras";

function num(value, semaforo = false) {
  if (value === 0) return <span className="text-slate-400 dark:text-ink-500">0</span>;
  const cls =
    semaforo && value < 0
      ? "rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-950/60 dark:text-red-400"
      : semaforo
        ? "font-medium text-emerald-700 dark:text-emerald-400"
        : "text-slate-700 dark:text-ink-200";
  return <span className={cls}>{fmt.format(value)}</span>;
}

/** Tabla modelo de negativos (con o sin columna de categoría), con búsqueda. */
export function NegativosTable({ rows, showCategoria = false }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) => r.sku.toLowerCase().includes(t) || r.descripcion.toLowerCase().includes(t) || (r.categoria || "").toLowerCase().includes(t)
    );
  }, [rows, q]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 dark:border-ink-700 sm:px-4">
        <div className="relative min-w-0 flex-1 sm:flex-none">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar SKU, descripción o categoría…" className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:placeholder:text-ink-400 sm:w-72" />
        </div>
        <span className="shrink-0 text-xs text-slate-500 dark:text-ink-400">{fmt.format(filtered.length)} artículos</span>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[inset_0_-1px_0_#e2e8f0] dark:bg-ink-800 dark:text-ink-300 dark:shadow-[inset_0_-1px_0_#343230]">
            <tr>
              <th className="px-4 py-2.5 text-left">SKU</th>
              <th className="px-4 py-2.5 text-left">Descripción</th>
              {showCategoria && <th className="px-4 py-2.5 text-left">Categoría</th>}
              <th className="px-3 py-2.5 text-center">Stk Jura</th>
              <th className="px-3 py-2.5 text-center">Disp Jura</th>
              <th className="px-3 py-2.5 text-center">Stk TML</th>
              <th className="px-3 py-2.5 text-center">Disp TML</th>
              <th className="px-3 py-2.5 text-center">OC</th>
              <th className="px-3 py-2.5 text-center">Falta comprar</th>
              <th className="px-3 py-2.5 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-ink-700">
            {filtered.map((r) => (
              <tr key={r.item_id} className="hover:bg-slate-50 dark:hover:bg-ink-800/60">
                <td className="px-4 py-2 text-left font-mono text-[13px] font-medium tracking-wide text-slate-700 dark:text-ink-200">{r.sku}</td>
                <td className="max-w-md truncate px-4 py-2 text-left text-slate-700 dark:text-ink-100" title={r.descripcion}>{r.descripcion}</td>
                {showCategoria && <td className="max-w-[180px] truncate px-4 py-2 text-left text-xs text-slate-500 dark:text-ink-300">{r.categoria}</td>}
                <td className="px-3 py-2 text-center">{num(r.stk_jura)}</td>
                <td className="px-3 py-2 text-center">{num(r.disp_jura, true)}</td>
                <td className="px-3 py-2 text-center">{num(r.stk_tml)}</td>
                <td className="px-3 py-2 text-center">{num(r.disp_tml, true)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={r.oc > 0 ? "font-medium text-slate-700 dark:text-ink-200" : "text-slate-400 dark:text-ink-500"}>{fmt.format(r.oc)}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={r.falta_comprar > 0 ? "rounded bg-orange-50 px-1.5 py-0.5 font-semibold text-orange-700 dark:bg-orange-950/60 dark:text-orange-400" : "text-slate-400 dark:text-ink-500"}>{fmt.format(r.falta_comprar)}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  {r.ok_compra ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">OK</span>
                  ) : (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950/60 dark:text-orange-400">Comprar</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={showCategoria ? 10 : 9} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-ink-400">Sin artículos para mostrar</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
