"use client";
import { useEffect, useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { fmtDec, fmtQty } from "@/lib/panel/format";

/** Panel lateral con el detalle de un artículo: meta, stock por depósito y precios. */
export function ItemDrawer({ itemId, onClose, onFilter }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setD(null);
    setErr(false);
    fetch(`/api/panel/item/${itemId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setD(j))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [itemId]);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const copySku = async () => {
    if (!d) return;
    try {
      await navigator.clipboard.writeText(d.item.item_code);
    } catch {
      /* contexto sin clipboard: ignorar */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const totFs = d
    ? d.storages.filter((s) => !s.sgl).reduce((a, s) => a + (Number(s.fs) || 0), 0)
    : 0;
  const totPs = d
    ? d.storages.filter((s) => !s.sgl).reduce((a, s) => a + (Number(s.ps) || 0), 0)
    : 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/50" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl dark:border-ink-700 dark:bg-ink-900">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        {!d && !err && (
          <div className="py-16 text-center text-sm text-slate-400 dark:text-ink-500">Cargando…</div>
        )}
        {err && (
          <div className="py-16 text-center text-sm text-slate-400 dark:text-ink-500">No se pudo cargar.</div>
        )}

        {d && (
          <>
            <h2 className="mb-4 pr-8 text-lg font-semibold text-slate-900 dark:text-ink-100">
              {d.item.item_desc}
            </h2>

            <div className="mb-6 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-slate-400 dark:text-ink-500">SKU</span>
                <span className="font-mono text-[13px] font-medium tracking-wide text-slate-800 dark:text-ink-100">
                  {d.item.item_code}
                </span>
                <button
                  onClick={copySku}
                  title="Copiar SKU"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-ink-800 dark:hover:text-ink-100"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-slate-400 dark:text-ink-500">Part number</span>
                <span className="font-mono text-[13px] text-slate-700 dark:text-ink-200">
                  {d.item.vendor_code || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-slate-400 dark:text-ink-500">Categoría</span>
                {d.item.cat_id ? (
                  <button
                    onClick={() => onFilter({ cat: d.item.cat_id })}
                    className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-ink-800 dark:text-brand-300 dark:hover:bg-ink-700"
                  >
                    {d.item.cat_desc || "?"}
                  </button>
                ) : (
                  <span className="text-slate-600 dark:text-ink-300">Sin categoría</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-slate-400 dark:text-ink-500">Marca</span>
                {d.item.brand_id ? (
                  <button
                    onClick={() => onFilter({ brand: d.item.brand_id })}
                    className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-ink-800 dark:text-brand-300 dark:hover:bg-ink-700"
                  >
                    {d.item.brand_desc || "?"}
                  </button>
                ) : (
                  <span className="text-slate-600 dark:text-ink-300">Sin marca</span>
                )}
              </div>
            </div>

            <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-ink-100">Stock por depósito</h4>
            {d.storages.length ? (
              <table className="mb-6 w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-ink-700 dark:text-ink-400">
                    <th className="py-1.5 text-left font-medium">Depósito</th>
                    <th className="py-1.5 text-center font-medium">Físico</th>
                    <th className="py-1.5 text-center font-medium">Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {d.storages.map((s, i) =>
                    s.sgl ? (
                      <tr
                        key={`sgl-${i}`}
                        title="Lo que informa el sistema del depósito TML (SGL)"
                        className="border-b border-slate-100 dark:border-ink-800"
                      >
                        <td className="py-1.5 text-left text-slate-400 dark:text-ink-500">↳ {s.stor_name}</td>
                        <td className="py-1.5 text-center font-semibold tabular-nums text-brand-600 dark:text-brand-300">
                          {fmtQty(s.fs)}
                        </td>
                        <td className="py-1.5 text-center text-slate-400 dark:text-ink-500">—</td>
                      </tr>
                    ) : (
                      <tr key={s.stor_id ?? i} className="border-b border-slate-100 dark:border-ink-800">
                        <td className="py-1.5 text-left text-slate-700 dark:text-ink-200">{s.stor_name}</td>
                        <td
                          className={`py-1.5 text-center font-semibold tabular-nums ${
                            Number(s.fs) === 0
                              ? "text-slate-400 dark:text-ink-500"
                              : "text-slate-900 dark:text-ink-100"
                          }`}
                        >
                          {fmtQty(s.fs)}
                        </td>
                        <td className="py-1.5 text-center tabular-nums text-slate-700 dark:text-ink-200">
                          {s.ps == null ? (
                            <span
                              className="text-slate-400 dark:text-ink-500"
                              title="Combo: la disponibilidad depende de sus componentes"
                            >
                              —
                            </span>
                          ) : (
                            fmtQty(s.ps)
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
                <tfoot>
                  <tr className="font-semibold text-slate-900 dark:text-ink-100">
                    <td className="py-1.5 text-left">Total</td>
                    <td className="py-1.5 text-center tabular-nums">{fmtQty(totFs)}</td>
                    <td className="py-1.5 text-center tabular-nums">{fmtQty(totPs)}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="mb-6 text-sm text-slate-500 dark:text-ink-400">Sin stock en ningún depósito.</p>
            )}

            <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-ink-100">Precios</h4>
            {d.prices.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-ink-700 dark:text-ink-400">
                    <th className="py-1.5 text-left font-medium">Lista</th>
                    <th className="py-1.5 text-center font-medium">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {d.prices.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-ink-800">
                      <td className="py-1.5 text-left text-slate-700 dark:text-ink-200">{p.prli_desc}</td>
                      <td className="py-1.5 text-center tabular-nums text-slate-900 dark:text-ink-100">
                        {p.price != null ? `${fmtDec(p.price)} ${p.curr || "ARS"}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500 dark:text-ink-400">Sin precio en las listas sincronizadas.</p>
            )}
          </>
        )}
      </aside>
    </>
  );
}
