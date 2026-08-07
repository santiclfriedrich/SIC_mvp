"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowRight, Send, Check } from "lucide-react";
import { PanelPage } from "@/components/panel/PanelPage";
import { EmptyAnalysis } from "@/components/panel/EmptyAnalysis";
import { ComprasFreshness } from "@/components/panel/ComprasFreshness";
import { EnviarTransferenciaModal } from "@/components/panel/EnviarTransferenciaModal";
import { useCompras, fmt } from "@/lib/panel/compras";

function fmtEnviado(at) {
  const d = new Date(at);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}/${d.getMonth() + 1} ${hh}:${mm}`;
}

export default function TransferenciasPage() {
  const { data, status, loading, refresh } = useCompras();
  const running = status?.state === "running";
  const [sel, setSel] = useState(new Set());
  const [enviar, setEnviar] = useState(false);
  const [enviadas, setEnviadas] = useState({});
  const [enviadasVer, setEnviadasVer] = useState(0);

  useEffect(() => {
    fetch("/api/panel/transferencias/enviadas")
      .then((r) => r.json())
      .then((j) => setEnviadas(j || {}))
      .catch(() => {});
  }, [enviadasVer]);

  const filas = data?.transferencias ?? [];
  const allSelected = filas.length > 0 && sel.size === filas.length;

  const toggle = (id) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(filas.map((r) => r.item_id)));

  const seleccionadas = useMemo(() => filas.filter((r) => sel.has(r.item_id)), [filas, sel]);

  return (
    <PanelPage title="Transferencias" subtitle="Negativos que se cubren moviendo stock entre Jura y TML (sin comprar)">
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300 dark:text-ink-500" size={32} /></div>
      ) : !data ? (
        <EmptyAnalysis status={status} onRefresh={refresh} />
      ) : (
        <>
          <ComprasFreshness data={data} running={running} onRefresh={refresh} />
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-ink-700">
              <span className="text-sm text-slate-500 dark:text-ink-300">
                {sel.size > 0 ? `${fmt.format(sel.size)} seleccionada${sel.size === 1 ? "" : "s"}` : "Movimientos sugeridos para cubrir negativos sin comprar"}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-ink-400">{fmt.format(filas.length)} artículos</span>
                <button onClick={() => setEnviar(true)} disabled={sel.size === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-700 dark:hover:bg-brand-600">
                  <Send size={14} />
                  Enviar a…
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-ink-800/60 dark:text-ink-300">
                  <tr>
                    <th className="w-10 px-4 py-2.5 text-center">
                      <input type="checkbox" aria-label="Seleccionar todo" checked={allSelected} onChange={toggleAll} disabled={filas.length === 0} className="h-4 w-4 cursor-pointer accent-brand-600" />
                    </th>
                    <th className="px-4 py-2.5 text-left">SKU</th>
                    <th className="px-4 py-2.5 text-left">Descripción</th>
                    <th className="px-3 py-2.5 text-center">Movimiento</th>
                    <th className="px-3 py-2.5 text-center">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-ink-700">
                  {filas.map((r) => {
                    const checked = sel.has(r.item_id);
                    const env = enviadas?.[String(r.item_id)];
                    return (
                      <tr key={r.item_id} onClick={() => toggle(r.item_id)} className={`cursor-pointer ${checked ? "bg-brand-50/60 dark:bg-ink-800" : "hover:bg-slate-50 dark:hover:bg-ink-800/60"}`}>
                        <td className="px-4 py-2 text-center">
                          <input type="checkbox" aria-label={`Seleccionar ${r.sku}`} checked={checked} onChange={() => toggle(r.item_id)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 cursor-pointer accent-brand-600" />
                        </td>
                        <td className="px-4 py-2 text-left font-mono text-[13px] font-medium tracking-wide text-slate-700 dark:text-ink-200">
                          {r.sku}
                          {env && (
                            <span className="ml-2 inline-flex items-center gap-0.5 align-middle text-[11px] font-normal text-slate-400 dark:text-ink-500" title={`Enviado ${fmtEnviado(env.at)} a ${(env.to || []).join(", ")}`}>
                              <Check size={11} /> enviado {fmtEnviado(env.at)}
                            </span>
                          )}
                        </td>
                        <td className="max-w-lg truncate px-4 py-2 text-left text-slate-700 dark:text-ink-100" title={r.descripcion}>{r.descripcion}</td>
                        <td className="px-3 py-2">
                          <span className="mx-auto flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-medium text-blue-700 dark:bg-ink-800 dark:text-brand-300">
                            {r.desde} <ArrowRight size={12} /> {r.hacia}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-slate-800 dark:text-ink-100">{fmt.format(r.cantidad)}</td>
                      </tr>
                    );
                  })}
                  {filas.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-ink-400">No hay transferencias sugeridas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {enviar && (
        <EnviarTransferenciaModal
          items={seleccionadas}
          onClose={() => setEnviar(false)}
          onSent={() => { setEnviar(false); setSel(new Set()); setEnviadasVer((v) => v + 1); }}
        />
      )}
    </PanelPage>
  );
}
