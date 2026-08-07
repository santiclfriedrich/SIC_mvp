"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PanelPage } from "@/components/panel/PanelPage";
import { NegativosTable } from "@/components/panel/NegativosTable";
import { EmptyAnalysis } from "@/components/panel/EmptyAnalysis";
import { ComprasFreshness } from "@/components/panel/ComprasFreshness";
import { StatTile } from "@/components/panel/StatTile";
import { useCompras, fmt } from "@/lib/panel/compras";

const TABS = [
  { key: "general", label: "General", slice: (d) => d.negativos },
  { key: "impresion", label: "Impresión", slice: (d) => d.impresion },
  { key: "hardware", label: "Hardware", slice: (d) => d.hardware },
  { key: "tiendas", label: "Tiendas", slice: (d) => d.tiendas },
];

const SUBTITULOS = {
  general: "Artículos con stock comprometido negativo y cuánto falta comprar",
  impresion: "Toner, cartuchos, impresoras, plotters, papel y scanners",
  hardware: "Todo lo que no es impresión ni categorías de tiendas",
  tiendas: "Categorías retail/hogar: climatización, electrodomésticos, herramientas…",
};

export function NegativosView({ initialTab = "general" }) {
  const { data, status, loading, refresh } = useCompras();
  const [tab, setTab] = useState(initialTab);
  const running = status?.state === "running";

  // al entrar por el sidebar (cambia la ruta / el prop) se reposiciona la pestaña
  useEffect(() => setTab(initialTab), [initialTab]);

  const activo = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <PanelPage title="Negativos / Comprar" subtitle={SUBTITULOS[tab]}>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300 dark:text-ink-500" size={32} /></div>
      ) : !data ? (
        <EmptyAnalysis status={status} onRefresh={refresh} />
      ) : (
        <>
          <ComprasFreshness data={data} running={running} onRefresh={refresh} />
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="SKUs analizados" value={fmt.format(data.resumen.total_skus)} hint="habilitados con control" />
            <StatTile tone="bad" label="Con negativo" value={fmt.format(data.resumen.con_negativo)} hint="Jura o TML en negativo" />
            <StatTile tone="bad" label="Falta comprar" value={fmt.format(data.resumen.total_falta_comprar)} hint="unidades tras transf. y OC" />
            <StatTile label="Transferencias" value={fmt.format(data.resumen.con_transferencia)} hint="se cubren moviendo stock" />
            <StatTile tone="good" label="Cubiertos por OC" value={fmt.format(data.resumen.skus_ok)} hint="sin faltante neto" />
            <StatTile tone="bad" label="Negativos ML Full" value={fmt.format(data.resumen.con_negativo_ml_full)} hint="disponible ML Full < 0" />
          </div>

          <div className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-ink-700 dark:bg-ink-800/60 lg:inline-flex">
            {TABS.map((t) => {
              const n = t.slice(data).length;
              const active = t.key === tab;
              return (
                <button key={t.key} onClick={() => setTab(t.key)} className={`flex shrink-0 items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? "bg-white text-brand-700 shadow-sm dark:bg-ink-900 dark:text-brand-300" : "text-slate-500 hover:text-slate-800 dark:text-ink-400 dark:hover:text-ink-100"}`}>
                  {t.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${active ? "bg-brand-50 text-brand-700 dark:bg-ink-800 dark:text-brand-300" : "bg-slate-200 text-slate-500 dark:bg-ink-700 dark:text-ink-300"}`}>{n}</span>
                </button>
              );
            })}
          </div>

          <NegativosTable rows={activo.slice(data)} showCategoria />
        </>
      )}
    </PanelPage>
  );
}
