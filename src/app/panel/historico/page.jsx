"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, Clock, CheckCircle2, Pencil, Eye } from "lucide-react";
import { PanelPage } from "@/components/panel/PanelPage";
import { Card } from "@/components/panel/Card";
import { StatTile } from "@/components/panel/StatTile";
import { AjusteModal } from "@/components/panel/AjusteModal";
import { fmtMoney, fmtQty } from "@/lib/panel/format";

function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR") + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

const th = "py-2 px-2 text-center text-xs font-medium text-slate-500 dark:text-ink-400";

export default function HistoricoPage() {
  const [qInput, setQInput] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [ver, setVer] = useState(0);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetch("/api/panel/historico")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (!cancel) { setData(j); setLoading(false); } })
      .catch(() => { if (!cancel) { setData({ rows: [] }); setLoading(false); } });
    return () => { cancel = true; };
  }, [ver]);

  const all = useMemo(() => data?.rows ?? [], [data]);

  const kpi = useMemo(() => {
    const enProceso = all.filter((r) => r.estado === "en_proceso").length;
    const finalizados = all.filter((r) => r.estado === "finalizado").length;
    const desvio = all.reduce((a, r) => a + Math.abs(Number(r.valor_diff) || 0), 0);
    return { total: all.length, enProceso, finalizados, desvio };
  }, [all]);

  const rows = useMemo(() => {
    const t = qInput.trim().toLowerCase();
    return all.filter(
      (r) =>
        (!estadoFiltro || r.estado === estadoFiltro) &&
        (!t ||
          r.sku.toLowerCase().includes(t) ||
          (r.descripcion || "").toLowerCase().includes(t) ||
          (r.comentario || "").toLowerCase().includes(t))
    );
  }, [all, qInput, estadoFiltro]);

  const toggleEstado = async (r) => {
    const next = r.estado === "finalizado" ? "en_proceso" : "finalizado";
    try {
      await fetch(`/api/panel/historico/${r.id}/estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: next }),
      });
      setVer((v) => v + 1);
    } catch {}
  };

  const borrar = async (r) => {
    if (!window.confirm(`¿Borrar el registro de ${r.sku} del histórico?`)) return;
    try {
      await fetch(`/api/panel/historico/${r.id}`, { method: "DELETE" });
      setVer((v) => v + 1);
    } catch {}
  };

  const filtroBtn = (value, label) => (
    <button onClick={() => setEstadoFiltro(value)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${estadoFiltro === value ? "bg-brand-600 text-white dark:bg-brand-700" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"}`}>
      {label}
    </button>
  );

  return (
    <PanelPage title="Histórico" subtitle="Diferencias de stock trabajadas — registro de casos analizados">
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Casos registrados" value={fmtQty(kpi.total)} hint="ajustes trabajados" />
        <StatTile label="En proceso" value={fmtQty(kpi.enProceso)} hint="sin cerrar" />
        <StatTile label="Finalizados" value={fmtQty(kpi.finalizados)} hint={`${kpi.total ? Math.round((kpi.finalizados / kpi.total) * 100) : 0}% del total`} />
        <StatTile tone="warn" label="Desvío a costo" value={fmtMoney(kpi.desvio, "ARS")} hint="suma de |dif × costo| registrada" />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Buscar SKU, descripción o motivo…" className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:placeholder:text-ink-400 sm:w-80" />
          </div>
          <div className="flex gap-2">
            {filtroBtn("", "Todos")}
            {filtroBtn("en_proceso", "En proceso")}
            {filtroBtn("finalizado", "Finalizados")}
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_#e2e8f0] dark:bg-ink-900 dark:shadow-[inset_0_-1px_0_#343230]">
              <tr>
                <th className={`${th} text-left`}>SKU</th>
                <th className={`${th} text-left`}>Descripción</th>
                <th className={th}>GBP</th>
                <th className={th}>SGL</th>
                <th className={th}>Dif.</th>
                <th className={th}>Desvío a costo</th>
                <th className={th}>Fecha</th>
                <th className={`${th} text-left`}>Motivo</th>
                <th className={th}>Estado</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-16 text-center text-sm text-slate-400 dark:text-ink-500">Cargando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="py-16 text-center text-sm text-slate-400 dark:text-ink-500">{all.length === 0 ? "Todavía no hay casos. Usá el botón Ajuste en Diferencias TML." : "Sin resultados con ese filtro."}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-ink-800">
                    <td className="py-2 px-2 text-left font-mono text-[13px] font-medium tracking-wide text-slate-700 dark:text-ink-200">{r.sku}</td>
                    <td className="max-w-[200px] truncate py-2 px-2 text-left text-slate-600 dark:text-ink-300" title={r.descripcion}>{r.descripcion || "—"}</td>
                    <td className="py-2 px-2 text-center tabular-nums text-slate-700 dark:text-ink-200">{fmtQty(r.gbp)}</td>
                    <td className="py-2 px-2 text-center tabular-nums text-slate-700 dark:text-ink-200">{fmtQty(r.sgl)}</td>
                    <td className={`py-2 px-2 text-center font-semibold tabular-nums ${r.diff < 0 ? "text-red-600 dark:text-red-400" : r.diff > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400 dark:text-ink-500"}`}>{r.diff > 0 ? "+" : ""}{fmtQty(r.diff)}</td>
                    <td className="py-2 px-2 text-center tabular-nums text-slate-700 dark:text-ink-200">{r.valor_diff ? fmtMoney(Math.abs(r.valor_diff), "ARS") : "—"}</td>
                    <td className="whitespace-nowrap py-2 px-2 text-center text-xs text-slate-500 dark:text-ink-400">{fmtFecha(r.created_at)}</td>
                    <td onClick={() => setViewRow(r)} className="max-w-[240px] cursor-pointer py-2 px-2 text-left align-top text-slate-600 hover:text-brand-600 dark:text-ink-300 dark:hover:text-brand-300">
                      <div className="truncate">{r.comentario || "—"}</div>
                      {r.areas?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.areas.map((a) => (<span key={a} className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-ink-800 dark:text-ink-400">{a}</span>))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button onClick={() => toggleEstado(r)} title="Clic para cambiar el estado" className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${r.estado === "finalizado" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:hover:bg-emerald-950" : "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-ink-800 dark:text-brand-300 dark:hover:bg-ink-700"}`}>
                        {r.estado === "finalizado" ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                        {r.estado === "finalizado" ? "Finalizado" : "En proceso"}
                      </button>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setViewRow(r)} title="Ver tarjeta" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-ink-800 dark:hover:text-ink-100"><Eye size={15} /></button>
                        <button onClick={() => setEditRow(r)} title="Editar caso" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-ink-800 dark:hover:text-brand-300"><Pencil size={15} /></button>
                        <button onClick={() => borrar(r)} title="Borrar registro" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editRow && (
        <AjusteModal
          editId={editRow.id}
          data={{ item_id: editRow.item_id, sku: editRow.sku, descripcion: editRow.descripcion, gbp: editRow.gbp, sgl: editRow.sgl, diff: editRow.diff, valor_diff: editRow.valor_diff }}
          initComentario={editRow.comentario}
          initEstado={editRow.estado}
          initAreas={editRow.areas}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); setVer((v) => v + 1); }}
        />
      )}

      {viewRow && (
        <AjusteModal
          readOnly
          data={{ item_id: viewRow.item_id, sku: viewRow.sku, descripcion: viewRow.descripcion, gbp: viewRow.gbp, sgl: viewRow.sgl, diff: viewRow.diff, valor_diff: viewRow.valor_diff }}
          initComentario={viewRow.comentario}
          initEstado={viewRow.estado}
          initAreas={viewRow.areas}
          onClose={() => setViewRow(null)}
        />
      )}
    </PanelPage>
  );
}
