"use client";
import { RefreshCw } from "lucide-react";

function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}/${d.getMonth() + 1} ${hh}:${mm}`;
}

/** Barra de frescura de Compras: antigüedad de la foto + botón de recálculo. */
export function ComprasFreshness({ data, running, onRefresh }) {
  if (!data) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-ink-700 dark:bg-ink-800/40">
      <span className="text-slate-500 dark:text-ink-400">
        {running ? (
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={13} className="animate-spin" />
            Actualizando negativos en vivo… (~2 min)
          </span>
        ) : (
          <>
            Datos al <span className="font-medium text-slate-700 dark:text-ink-200">{fmtFecha(data.updated_at)}</span> · actualizá antes de comprar
          </>
        )}
      </span>
      <button onClick={onRefresh} disabled={running} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700">
        <RefreshCw size={13} className={running ? "animate-spin" : undefined} />
        Actualizar
      </button>
    </div>
  );
}
