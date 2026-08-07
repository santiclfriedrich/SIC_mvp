"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, Boxes, ArrowLeftRight, TrendingDown, TrendingUp, RefreshCw, Search } from "lucide-react";

// Se reinicia por sesión; sube la versión para volver a mostrarlo.
const SESSION_KEY = "whats_new_v5_seen";
// El cartel deja de aparecer solo después de esta fecha (2 semanas desde el
// lanzamiento de la migración del panel).
const EXPIRES = new Date("2026-08-21T23:59:59-03:00");

const FEATURES = [
  {
    icon: Boxes,
    title: "Panel unificado con el comparador",
    desc: "El BI del stock y el comparador de precios ahora viven en un solo lugar, con el mismo login y diseño.",
  },
  {
    icon: Boxes,
    title: "Almacenamiento",
    desc: "Resumen, Artículos, Depósitos, Diferencias TML e Histórico — stock, disponibles y valorización en vivo.",
  },
  {
    icon: TrendingDown,
    title: "Compras",
    desc: "Negativos / Comprar (con Impresión, Hardware y Tiendas), ML Full y Transferencias. El Comparador quedó acá dentro.",
  },
  {
    icon: TrendingUp,
    title: "Ventas",
    desc: "Facturación con comparativas por período, canales B2C/B2B y detalle exportable a Excel.",
  },
  {
    icon: ArrowLeftRight,
    title: "Diferencias TML + Ajustes",
    desc: "Comparación GBP vs SGL con registro de ajustes en el histórico y envío de transferencias por mail.",
  },
  {
    icon: RefreshCw,
    title: "Sincronización con el ERP",
    desc: "Los datos se actualizan desde GlobalBluePoint; podés forzar la sincronización con el botón de arriba.",
  },
];

export const WhatsNewModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const vigente = new Date() <= EXPIRES;
      if (vigente && !sessionStorage.getItem(SESSION_KEY)) setOpen(true);
    } catch {}
  }, []);

  const handleClose = () => {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(13, 24, 41, 0.6)", backdropFilter: "blur(4px)" }}>
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-ink-900">
        <div className="sticky top-0 rounded-t-2xl border-b border-slate-200 bg-white px-6 pt-6 pb-4 dark:border-ink-700 dark:bg-ink-900">
          <button onClick={handleClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100" aria-label="Cerrar">
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-ink-800">
              <Sparkles size={20} className="text-brand-600 dark:text-brand-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-ink-100">Novedades</h2>
                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">v5.0</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-ink-400">Argentina Color · Panel unificado</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-ink-800">
                <Icon size={15} className="text-brand-600 dark:text-brand-300" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-ink-100">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-ink-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <button onClick={handleClose} className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
