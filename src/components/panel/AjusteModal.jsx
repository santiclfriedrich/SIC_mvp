"use client";
import { useEffect, useRef, useState } from "react";
import { X, Clock, CheckCircle2, ChevronDown } from "lucide-react";
import { fmtMoney, fmtQty } from "@/lib/panel/format";

/** Áreas responsables del desvío (multi-select). "Otra" se escribe aparte. */
const AREAS = [
  "Administración", "RMA", "Depósito Arg", "Compras", "Recepción Arg",
  "Recepción TML", "Ventas Corpo", "Almacén TML", "Pedidos TML",
];

/** Tarjeta de un caso de ajuste. Tres modos: crear / editar (editId) / ver (readOnly). */
export function AjusteModal({
  data,
  editId,
  readOnly = false,
  initComentario = "",
  initEstado = "en_proceso",
  initAreas = [],
  onClose,
  onSaved,
}) {
  const [comentario, setComentario] = useState(initComentario);
  const [estado, setEstado] = useState(initEstado);
  const [areas, setAreas] = useState((initAreas || []).filter((a) => AREAS.includes(a)));
  const [otra, setOtra] = useState((initAreas || []).filter((a) => !AREAS.includes(a)).join(", "));
  const [openAreas, setOpenAreas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const editing = editId != null;
  const areasRef = useRef(null);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  useEffect(() => {
    if (!openAreas) return;
    const onClick = (e) => {
      if (areasRef.current && !areasRef.current.contains(e.target)) setOpenAreas(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openAreas]);

  const otraList = otra.split(",").map((s) => s.trim()).filter(Boolean);
  const seleccionadas = [...areas, ...otraList];

  const toggleArea = (a) =>
    setAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      const body = editing
        ? { comentario, estado, areas: seleccionadas }
        : {
            item_id: data.item_id, sku: data.sku, descripcion: data.descripcion,
            gbp: data.gbp, sgl: data.sgl, diff: data.diff,
            comentario, estado, areas: seleccionadas,
          };
      const url = editing ? `/api/panel/historico/${editId}` : `/api/panel/historico`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      onSaved?.();
    } catch {
      setErr("No se pudo guardar. Probá de nuevo.");
      setSaving(false);
    }
  };

  const estadoBtn = (value, label) => {
    const active = estado === value;
    const base = "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors";
    const on = value === "finalizado"
      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
      : "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-ink-800 dark:text-brand-300";
    const off = "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700";
    return (
      <button type="button" onClick={() => setEstado(value)} className={`${base} ${active ? on : off}`}>
        {label}
      </button>
    );
  };

  const cell = (label, value, tone = "") => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center dark:border-ink-700 dark:bg-ink-800/60">
      <div className="text-[11px] text-slate-400 dark:text-ink-500">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${tone || "text-slate-900 dark:text-ink-100"}`}>{value}</div>
    </div>
  );

  const diffTone = data.diff < 0 ? "text-red-600 dark:text-red-400" : data.diff > 0 ? "text-emerald-700 dark:text-emerald-400" : "";
  const titulo = readOnly ? "Detalle del caso" : editing ? "Editar caso" : "Registrar ajuste";
  const subtitulo = readOnly ? "Vista de solo lectura." : editing ? "Actualizá el motivo, las áreas o el estado del caso." : "Se congela la foto actual del caso en el histórico.";
  const chip = "inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-ink-800 dark:text-brand-300";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-900" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-ink-700">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-ink-100">{titulo}</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-ink-400">{subtitulo}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <div className="font-mono text-[13px] font-medium tracking-wide text-slate-800 dark:text-ink-100">{data.sku}</div>
              <div className="text-sm text-slate-500 dark:text-ink-300">{data.descripcion || "—"}</div>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {cell("GBP (TML)", fmtQty(data.gbp))}
              {cell("SGL", fmtQty(data.sgl))}
              {cell("Diferencia", `${data.diff > 0 ? "+" : ""}${fmtQty(data.diff)}`, diffTone)}
              {cell("Desvío a costo", data.valor_diff != null ? fmtMoney(Math.abs(data.valor_diff), "ARS") : "—")}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-ink-200">Área de desvío</label>
              {readOnly ? (
                seleccionadas.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {seleccionadas.map((a) => (<span key={a} className={chip}>{a}</span>))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 dark:text-ink-500">— sin área asignada —</div>
                )
              ) : (
                <div className="relative" ref={areasRef}>
                  <button type="button" onClick={() => setOpenAreas((o) => !o)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100">
                    <span className="min-w-0 flex-1">
                      {seleccionadas.length ? (
                        <span className="flex flex-wrap gap-1.5">
                          {seleccionadas.map((a) => (<span key={a} className={chip}>{a}</span>))}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-ink-500">Seleccioná una o varias áreas…</span>
                      )}
                    </span>
                    <ChevronDown size={16} className={`flex-none text-slate-400 transition-transform ${openAreas ? "rotate-180" : ""}`} />
                  </button>
                  {openAreas && (
                    <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-ink-600 dark:bg-ink-800">
                      {AREAS.map((a) => {
                        const on = areas.includes(a);
                        return (
                          <button key={a} type="button" onClick={() => toggleArea(a)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-ink-100 dark:hover:bg-ink-700">
                            <span className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${on ? "border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-600" : "border-slate-300 dark:border-ink-500"}`}>
                              {on && <CheckCircle2 size={11} />}
                            </span>
                            {a}
                          </button>
                        );
                      })}
                      <div className="mt-1 border-t border-slate-100 px-3 py-2 dark:border-ink-700">
                        <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-ink-400">Otra (separá con coma)</label>
                        <input value={otra} onChange={(e) => setOtra(e.target.value)} placeholder="Escribí otra área…" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-100" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-ink-200">Motivo del desvío</label>
              {readOnly ? (
                <div className="min-h-[6rem] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-200">
                  {comentario || "— sin motivo cargado —"}
                </div>
              ) : (
                <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={4} placeholder="Qué se detectó, causa probable, acción tomada…" className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100" />
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-ink-200">Estado</label>
              {readOnly ? (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${estado === "finalizado" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400" : "bg-brand-50 text-brand-700 dark:bg-ink-800 dark:text-brand-300"}`}>
                  {estado === "finalizado" ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                  {estado === "finalizado" ? "Finalizado" : "En proceso"}
                </span>
              ) : (
                <div className="flex gap-2">
                  {estadoBtn("en_proceso", "En proceso")}
                  {estadoBtn("finalizado", "Finalizado")}
                </div>
              )}
            </div>

            {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-ink-700">
            {readOnly ? (
              <button onClick={onClose} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 dark:bg-brand-700 dark:hover:bg-brand-600">Cerrar</button>
            ) : (
              <>
                <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-800">Cancelar</button>
                <button onClick={save} disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-700 dark:hover:bg-brand-600">
                  {saving ? "Guardando…" : editing ? "Guardar cambios" : "Guardar en histórico"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
