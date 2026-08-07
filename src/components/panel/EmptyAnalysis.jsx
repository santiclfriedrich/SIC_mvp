"use client";
import { DatabaseZap, Loader2 } from "lucide-react";

/** Estado vacío de Compras: todavía no se corrió ningún análisis contra el ERP. */
export function EmptyAnalysis({ status, onRefresh }) {
  const running = status?.state === "running";
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-ink-600 dark:bg-ink-900">
      {running ? (
        <>
          <Loader2 className="mx-auto animate-spin text-brand-600 dark:text-brand-500" size={36} />
          <h2 className="mt-4 text-lg font-medium text-slate-700 dark:text-ink-100">Trayendo datos del ERP…</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-ink-300">{status?.step || "Procesando…"} La carga completa tarda un minuto.</p>
        </>
      ) : (
        <>
          <DatabaseZap className="mx-auto text-slate-300 dark:text-ink-500" size={36} />
          <h2 className="mt-4 text-lg font-medium text-slate-700 dark:text-ink-100">Todavía no hay datos</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-ink-300">
            Ejecutá la primera actualización para traer stock, disponibles y órdenes de compra desde GlobalBluePoint.
          </p>
          <button onClick={onRefresh} className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 dark:bg-brand-700 dark:hover:bg-brand-600">
            Actualizar desde ERP
          </button>
        </>
      )}
    </div>
  );
}
