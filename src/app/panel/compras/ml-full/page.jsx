"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { PanelPage } from "@/components/panel/PanelPage";
import { EmptyAnalysis } from "@/components/panel/EmptyAnalysis";
import { useCompras, fmt } from "@/lib/panel/compras";

export default function MlFullPage() {
  const { data, status, loading, refresh } = useCompras();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    if (!t) return data.ml_full;
    return data.ml_full.filter((r) => r.sku.toLowerCase().includes(t) || r.descripcion.toLowerCase().includes(t));
  }, [data, q]);

  return (
    <PanelPage title="ML Full" subtitle="Artículos con disponible negativo en el depósito ML Full">
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300 dark:text-ink-500" size={32} /></div>
      ) : !data ? (
        <EmptyAnalysis status={status} onRefresh={refresh} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 dark:border-ink-700 sm:px-4">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar SKU o descripción…" className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:placeholder:text-ink-400 sm:w-72" />
            </div>
            <span className="shrink-0 text-xs text-slate-500 dark:text-ink-400">{fmt.format(rows.length)} artículos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-ink-800/60 dark:text-ink-300">
                <tr>
                  <th className="px-4 py-2.5 text-left">SKU</th>
                  <th className="px-4 py-2.5 text-left">Descripción</th>
                  <th className="px-3 py-2.5 text-center">Stk ML Full</th>
                  <th className="px-3 py-2.5 text-center">Disp ML Full</th>
                  <th className="px-3 py-2.5 text-center">OC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-ink-700">
                {rows.map((r) => (
                  <tr key={r.item_id} className="hover:bg-slate-50 dark:hover:bg-ink-800/60">
                    <td className="px-4 py-2 text-left font-mono text-[13px] font-medium tracking-wide text-slate-700 dark:text-ink-200">{r.sku}</td>
                    <td className="max-w-lg truncate px-4 py-2 text-left text-slate-700 dark:text-ink-100" title={r.descripcion}>{r.descripcion}</td>
                    <td className="px-3 py-2 text-center text-slate-700 dark:text-ink-200">{fmt.format(r.stk_ml_full)}</td>
                    <td className="px-3 py-2 text-center"><span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-950/60 dark:text-red-400">{fmt.format(r.disp_ml_full)}</span></td>
                    <td className="px-3 py-2 text-center"><span className={r.oc > 0 ? "font-medium text-slate-700 dark:text-ink-200" : "text-slate-400 dark:text-ink-500"}>{fmt.format(r.oc)}</span></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-ink-400">Sin negativos en ML Full 🎉</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PanelPage>
  );
}
