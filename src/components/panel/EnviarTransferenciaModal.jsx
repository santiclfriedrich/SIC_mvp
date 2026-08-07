"use client";
import { useEffect, useState } from "react";
import { X, Send, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { fmt } from "@/lib/panel/compras";

function asuntoDe(items) {
  const dirs = [];
  for (const r of items) {
    const d = `${r.desde}-${r.hacia}`;
    if (!dirs.includes(d)) dirs.push(d);
  }
  return dirs.length ? `Transferencia ${dirs.join(" y ")}` : "Transferencia";
}

export function EnviarTransferenciaModal({ items, onClose, onSent }) {
  const [cfg, setCfg] = useState(null);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(() => asuntoDe(items));
  const [nota, setNota] = useState("Buen día, dejo el detalle:");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    fetch("/api/panel/transferencias/config")
      .then((r) => r.json())
      .then((c) => {
        setCfg(c);
        setTo((c.default_to || []).join(", "));
        setCc((c.default_cc || []).join(", "));
      })
      .catch(() => setCfg({ default_to: [], default_cc: [], mail_enabled: false, from: null }));
  }, []);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const enviar = async () => {
    setSending(true);
    setErr("");
    try {
      const r = await fetch("/api/panel/transferencias/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, cc, subject, nota, item_ids: items.map((i) => i.item_id) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "No se pudo enviar. Probá de nuevo.");
      const n = j.lineas, dst = (j.enviado_a || []).length;
      setOkMsg(`Enviado: ${n} línea${n === 1 ? "" : "s"} a ${dst} destinatario${dst === 1 ? "" : "s"}.`);
      setTimeout(onSent, 1200);
    } catch (e) {
      setErr(e?.message || "No se pudo enviar. Probá de nuevo.");
      setSending(false);
    }
  };

  const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-900" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-ink-700">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-ink-100">Enviar transferencia por mail</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-ink-400">
                {items.length} línea{items.length === 1 ? "" : "s"} seleccionada{items.length === 1 ? "" : "s"}{cfg?.from ? ` · desde ${cfg.from}` : ""}
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100" aria-label="Cerrar"><X size={18} /></button>
          </div>

          <div className="flex-1 space-y-4 overflow-auto p-5">
            {cfg && !cfg.mail_enabled && (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle size={16} className="mt-0.5 flex-none" />
                <span>El envío de correo todavía no está configurado en el servidor. Cargá <code>SMTP_USER</code> y <code>SMTP_PASS</code> (contraseña de aplicación de Gmail) en el entorno y reiniciá.</span>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-ink-200">Para</label>
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="walter@argentinacolor.com, maria@argentinacolor.com" className={input} />
              <p className="mt-1 text-[11px] text-slate-400 dark:text-ink-500">Separá varios con coma. Podés agregar o quitar antes de enviar.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-ink-200">CC (opcional)</label>
              <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="copia@argentinacolor.com" className={input} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-ink-200">Asunto</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-ink-200">Nota</label>
              <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className={`${input} resize-y`} />
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-slate-700 dark:text-ink-200">Detalle que se envía</div>
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-ink-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-ink-800/60 dark:text-ink-300">
                    <tr>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-left">Descripción</th>
                      <th className="px-3 py-2 text-center">Movimiento</th>
                      <th className="px-3 py-2 text-center">Cant.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-ink-700">
                    {items.map((r) => (
                      <tr key={r.item_id}>
                        <td className="px-3 py-1.5 font-mono text-[13px] text-slate-700 dark:text-ink-200">{r.sku}</td>
                        <td className="max-w-xs truncate px-3 py-1.5 text-slate-700 dark:text-ink-100" title={r.descripcion}>{r.descripcion}</td>
                        <td className="px-3 py-1.5 text-center text-xs text-slate-500 dark:text-ink-300">
                          <span className="inline-flex items-center gap-1">{r.desde} <ArrowRight size={11} /> {r.hacia}</span>
                        </td>
                        <td className="px-3 py-1.5 text-center font-semibold text-slate-800 dark:text-ink-100">{fmt.format(r.cantidad)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
            {okMsg && <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={15} /> {okMsg}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-ink-700">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-800">Cancelar</button>
            <button onClick={enviar} disabled={sending || !!okMsg || !cfg?.mail_enabled} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-700 dark:hover:bg-brand-600">
              <Send size={15} />
              {sending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
