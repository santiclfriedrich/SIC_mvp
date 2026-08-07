"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Upload, ClipboardPen, ArrowUpNarrowWide, ArrowDownWideNarrow, FileDown } from "lucide-react";
import { PanelPage } from "@/components/panel/PanelPage";
import { Card } from "@/components/panel/Card";
import { StatTile } from "@/components/panel/StatTile";
import { ItemDrawer } from "@/components/panel/ItemDrawer";
import { AjusteModal } from "@/components/panel/AjusteModal";
import { fmtMoney, fmtQty } from "@/lib/panel/format";

function fuenteText(info) {
  if (info.source === "api") {
    return `Foto de SGL: ${info.snapshot || "?"} · ${fmtQty(info.rows || 0)} SKUs (vía API)`;
  }
  const at = info.at ? new Date(info.at).toLocaleString("es-AR") : "?";
  return `Última carga manual: ${at} · ${info.file || ""} · ${fmtQty(info.rows || 0)} SKUs`;
}

function Badge({ r }) {
  const warn = "rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950/60 dark:text-orange-400";
  const neg = "rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-400";
  if (r.estado === "solo_gbp") return <span className={warn}>solo en GBP</span>;
  if (r.estado === "solo_sgl") return <span className={warn}>solo en SGL</span>;
  return <span className={neg}>{r.diff > 0 ? `GBP +${fmtQty(r.diff)}` : `SGL +${fmtQty(-r.diff)}`}</span>;
}

const th = "py-2 px-2 text-center text-xs font-medium text-slate-500 dark:text-ink-400";

export default function DiferenciasPage() {
  const [solo, setSolo] = useState(true);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [ver, setVer] = useState(0);
  const [sort, setSort] = useState("desvio");
  const [dir, setDir] = useState("desc");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState(null);
  const [ajuste, setAjuste] = useState(null);
  const [okMsg, setOkMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    fetch("/api/panel/status")
      .then((r) => r.json())
      .then((j) => setLastSyncAt(j?.last_sync?.at || null))
      .catch(() => {});
  }, [ver]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(false);
    const p = new URLSearchParams({ solo: solo ? "1" : "0", q, sort, dir });
    fetch(`/api/panel/diferencias?${p.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (!cancel) { setData(j); setLoading(false); } })
      .catch(() => { if (!cancel) { setError(true); setLoading(false); } });
    return () => { cancel = true; };
  }, [solo, q, ver, sort, dir]);

  const startSync = async () => {
    setSyncing(true);
    setMsg("Lanzando sincronización completa (GBP + SGL)…");
    try {
      const r = await fetch("/api/panel/sync", { method: "POST" });
      if (r.status >= 400) throw new Error();
      setMsg("Sincronización lanzada — el stock se actualiza en un par de minutos (seguí el progreso con “Sincronizar” arriba).");
    } catch {
      setMsg("⚠ No se pudo lanzar la sincronización.");
    } finally {
      setSyncing(false);
    }
  };

  const refreshSgl = async () => {
    setBusy(true);
    setMsg("Consultando la API de SGL…");
    try {
      const r = await fetch("/api/panel/sgl/refresh", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "no se pudo actualizar");
      setMsg("");
      setVer((v) => v + 1);
    } catch (e) {
      setMsg("⚠ " + (e?.message || "no se pudo actualizar"));
    } finally {
      setBusy(false);
    }
  };

  const uploadSgl = async (file) => {
    setMsg("Subiendo y procesando…");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/panel/sgl/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "no se pudo procesar");
      setMsg("");
      setVer((v) => v + 1);
    } catch (e) {
      setMsg("⚠ " + (e?.message || "no se pudo procesar"));
    }
  };

  const info = data?.sgl_info;
  const k = data?.kpi;
  const rows = data?.rows || [];

  const sglBox = (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-ink-100">Datos de SGL</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-ink-400">
            {info ? fuenteText(info) : "Todavía no hay datos de SGL."}
          </p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-ink-500">
            Stock GBP (TML):{" "}
            {lastSyncAt
              ? new Date(lastSyncAt).toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })
              : "—"}{" "}
            · se sincroniza cada hora (7–18)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={startSync} disabled={syncing} title="Trae stock GBP (TML) + SGL — sincronización completa (~2 min)" className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-700 dark:hover:bg-brand-600">
            <RefreshCw size={15} className={syncing ? "animate-spin" : undefined} />
            {syncing ? "Actualizando…" : "Actualizar todo (GBP + SGL)"}
          </button>
          <button onClick={refreshSgl} disabled={busy} title="Rápido: solo el stock de SGL en vivo (el stock GBP queda de la última sync)" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700">
            <RefreshCw size={15} className={busy ? "animate-spin" : undefined} />
            Solo SGL
          </button>
          <button onClick={() => fileRef.current?.click()} title="Alternativa manual si la API no responde" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700">
            <Upload size={15} />
            Subir archivo
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSgl(f); e.target.value = ""; }} />
        </div>
      </div>
      {msg && <p className="mt-2 text-xs text-slate-500 dark:text-ink-400">{msg}</p>}
    </Card>
  );

  return (
    <PanelPage title="Diferencias de stock — TML" subtitle="Compara el depósito TML según GBP contra el sistema del depósito (SGL)">
      <div className="space-y-5">
        {sglBox}

        {loading && !data ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-ink-900" />
        ) : !info ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-ink-700 dark:bg-ink-900/40">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-ink-100">Sin datos de SGL todavía</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-ink-300">Tocá <b>“Solo SGL”</b> para traer el stock del depósito en vivo.</p>
          </div>
        ) : (
          <>
            {k && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile label="SKUs comparados" value={fmtQty(k.comparados)} hint={`${fmtQty(k.coinciden)} coinciden`} />
                <StatTile tone={k.con_diferencia ? "warn" : "default"} label="Con diferencia" value={fmtQty(k.con_diferencia)} hint={`${fmtQty(k.unidades_diff)} unidades de desvío`} />
                <StatTile label="Solo en GBP / solo en SGL" value={`${fmtQty(k.solo_gbp)} / ${fmtQty(k.solo_sgl)}`} hint="artículos sin contraparte" />
                <StatTile tone={k.valor_diff ? "warn" : "default"} label="Desvío valorizado" value={fmtMoney(k.valor_diff, "ARS")} hint="a costo, suma de |diferencias|" />
              </div>
            )}

            <Card title="Detalle">
              <div className="mb-3 flex flex-wrap items-center gap-4">
                <input type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Buscar código o descripción…" className="min-w-[16rem] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100" />
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-ink-300">
                  <input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} className="accent-brand-600" />
                  Mostrar solo diferencias
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-slate-400 dark:text-ink-500">Ordenar por</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100">
                    <option value="desvio">Desvío a costo</option>
                    <option value="dif">Diferencia</option>
                    <option value="gbp">GBP (TML)</option>
                    <option value="sgl">SGL</option>
                  </select>
                  <button onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))} title={dir === "asc" ? "Menor a mayor" : "Mayor a menor"} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700">
                    {dir === "asc" ? <ArrowUpNarrowWide size={15} /> : <ArrowDownWideNarrow size={15} />}
                    {dir === "asc" ? "Menor a mayor" : "Mayor a menor"}
                  </button>
                  <a href={`/api/panel/diferencias.xlsx?solo=${solo ? 1 : 0}&q=${encodeURIComponent(q)}&sort=${sort}&dir=${dir}`} title="Descargar el detalle en Excel" className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/70">
                    <FileDown size={15} />
                    Excel
                  </a>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_#e2e8f0] dark:bg-ink-900 dark:shadow-[inset_0_-1px_0_#343230]">
                    <tr>
                      <th className={`${th} text-left`}>SKU</th>
                      <th className={`${th} text-left`}>Descripción</th>
                      <th className={th}>GBP (TML)</th>
                      <th className={th}>SGL</th>
                      <th className={th}>Diferencia</th>
                      <th className={th}>Desvío a costo</th>
                      <th className={th}>Estado</th>
                      <th className={th}>Ajuste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length ? (
                      rows.map((r, i) => (
                        <tr key={`${r.sku}-${i}`} onClick={() => r.item_id && setSelected(r.item_id)} className={`border-b border-slate-100 last:border-0 dark:border-ink-800 ${r.item_id ? "cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-ink-800/60" : ""}`}>
                          <td className="py-2 px-2 text-left font-mono text-[13px] font-medium tracking-wide text-slate-700 dark:text-ink-200">{r.sku}</td>
                          <td className="py-2 px-2 text-left text-slate-600 dark:text-ink-300">{r.desc || "—"}</td>
                          <td className="py-2 px-2 text-center tabular-nums text-slate-700 dark:text-ink-200">{fmtQty(r.gbp)}</td>
                          <td className="py-2 px-2 text-center tabular-nums text-slate-700 dark:text-ink-200">{fmtQty(r.sgl)}</td>
                          <td className="py-2 px-2 text-center font-semibold tabular-nums text-slate-900 dark:text-ink-100">{r.diff > 0 ? "+" : ""}{fmtQty(r.diff)}</td>
                          <td className="py-2 px-2 text-center tabular-nums text-slate-700 dark:text-ink-200">{r.valor_diff ? fmtMoney(Math.abs(r.valor_diff), "ARS") : "—"}</td>
                          <td className="py-2 px-2 text-center"><Badge r={r} /></td>
                          <td className="py-2 px-2 text-center">
                            <button onClick={(e) => { e.stopPropagation(); setAjuste(r); }} title="Registrar ajuste en el histórico" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 dark:border-ink-600 dark:text-ink-300 dark:hover:border-ink-500 dark:hover:bg-ink-800 dark:hover:text-brand-300">
                              <ClipboardPen size={13} />
                              Ajuste
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400 dark:text-ink-500">Sin resultados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {selected !== null && (
        <ItemDrawer itemId={selected} onClose={() => setSelected(null)} onFilter={() => setSelected(null)} />
      )}

      {ajuste && (
        <AjusteModal
          data={{ item_id: ajuste.item_id, sku: ajuste.sku, descripcion: ajuste.desc, gbp: ajuste.gbp, sgl: ajuste.sgl, diff: ajuste.diff, valor_diff: ajuste.valor_diff }}
          onClose={() => setAjuste(null)}
          onSaved={() => { const sku = ajuste.sku; setAjuste(null); setOkMsg(`Ajuste de ${sku} guardado en el histórico.`); setTimeout(() => setOkMsg(""), 4000); }}
        />
      )}

      {okMsg && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">{okMsg}</div>
      )}
    </PanelPage>
  );
}
