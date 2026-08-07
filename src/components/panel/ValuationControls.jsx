"use client";
import { useEffect, useRef, useState } from "react";

const selCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:hover:border-ink-600";

export function ValuationControls({ prli, onPrli, priceLists, cotizacion, onCotizacion }) {
  const [cot, setCot] = useState(cotizacion ?? "");
  const timer = useRef(null);

  useEffect(() => {
    setCot(cotizacion ?? "");
  }, [cotizacion]);

  const handleCot = (v) => {
    setCot(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const n = Number(v);
      if (n > 0) onCotizacion(n);
    }, 600);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-ink-400">
        Valorizar
        <select value={prli} onChange={(e) => onPrli(Number(e.target.value))} className={selCls}>
          {priceLists.length === 0 && <option value={0}>Costo — 01-Lista de Costos</option>}
          {priceLists.map((pl) => (
            <option key={pl.prli_id} value={pl.prli_id}>
              {pl.prli_desc}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-ink-400">
        USD→ARS
        <input
          type="number"
          value={cot}
          onChange={(e) => handleCot(e.target.value)}
          className={`w-24 ${selCls}`}
          min="0"
          step="0.01"
        />
      </label>
    </div>
  );
}
