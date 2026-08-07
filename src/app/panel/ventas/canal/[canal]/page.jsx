"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";
import { PanelPage } from "@/components/panel/PanelPage";
import { Card } from "@/components/panel/Card";
import { StatTile } from "@/components/panel/StatTile";
import { fmtDec, fmtMoney, fmtQty } from "@/lib/panel/format";

const CANALES = { b2c: "B2C (web + ML)", b2b: "B2B (corporativo/mayorista)" };
const PERIODOS = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Semana" },
  { key: "quincena", label: "Quincena" },
  { key: "mes", label: "Mes" },
  { key: "anio", label: "Año" },
];

function TablaTop({ cols, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-ink-700">
            {cols.map((c, i) => (<th key={c} className={`py-2 px-2 text-xs font-medium text-slate-500 dark:text-ink-400 ${i === 0 ? "text-left" : "text-right"}`}>{c}</th>))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, ri) => (
              <tr key={ri} className="border-b border-slate-100 last:border-0 dark:border-ink-800">
                {r.map((cell, ci) => (
                  <td key={ci} className={`py-2 px-2 ${ci === 0 ? "text-left" : "text-right tabular-nums text-slate-800 dark:text-ink-100"} ${ci === 1 && cols.length === 4 ? "max-w-[220px] truncate" : ""}`}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr><td colSpan={cols.length} className="py-10 text-center text-sm text-slate-400 dark:text-ink-500">Sin datos.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function VentasCanalInner() {
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const canalParam = (Array.isArray(params?.canal) ? params.canal[0] : params?.canal) || "b2c";
  const key = canalParam.toLowerCase() === "b2b" ? "b2b" : "b2c";
  const canalApi = key.toUpperCase();
  const periodo = sp.get("p") || "mes";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetch(`/api/panel/ventas/canal?canal=${canalApi}&periodo=${periodo}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (!cancel) { setData(j); setLoading(false); } })
      .catch(() => { if (!cancel) { setData(null); setLoading(false); } });
    return () => { cancel = true; };
  }, [canalApi, periodo]);

  const go = (k, p) => router.push(`/panel/ventas/canal/${k}?p=${p}`);
  const seg = "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
  const on = "bg-white text-brand-700 shadow-sm dark:bg-ink-900 dark:text-brand-300";
  const off = "text-slate-500 hover:text-slate-800 dark:text-ink-400 dark:hover:text-ink-100";
  const kpi = data?.kpi;

  return (
    <PanelPage title={`Ventas — ${CANALES[key]}`} subtitle="Facturación neta de notas de crédito · clic en el período para cambiarlo">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-ink-700 dark:bg-ink-800/60">
          {["b2c", "b2b"].map((c) => (<button key={c} onClick={() => go(c, periodo)} className={`${seg} ${key === c ? on : off}`}>{c.toUpperCase()}</button>))}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-ink-700 dark:bg-ink-800/60">
          {PERIODOS.map((p) => (<button key={p.key} onClick={() => go(key, p.key)} className={`${seg} ${periodo === p.key ? on : off}`}>{p.label}</button>))}
        </div>
      </div>

      {loading && !data ? (
        <div className="grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (<div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-ink-900" />))}
        </div>
      ) : !kpi ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-ink-700 dark:bg-ink-900/40">
          <p className="text-sm text-slate-500 dark:text-ink-300">Sin ventas en este período para el canal.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
              <div className="text-xs font-medium text-slate-500 dark:text-ink-400">Facturado</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-ink-100">{fmtMoney(kpi.facturado, "ARS")}</div>
              <div className="mt-1">
                {kpi.var == null ? (
                  <span className="text-xs text-slate-400 dark:text-ink-500">sin período anterior</span>
                ) : (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${kpi.var >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    {kpi.var >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {fmtDec(Math.abs(kpi.var))}% vs período anterior
                  </span>
                )}
              </div>
            </div>
            <StatTile label="Comprobantes" value={fmtQty(kpi.comprobantes)} hint="facturas del período" />
            <StatTile label="Ticket promedio" value={fmtMoney(kpi.ticket, "ARS")} hint="facturado / comprobantes" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Top 10 productos">
              <TablaTop cols={["SKU", "Descripción", "Unid.", "Facturado"]} rows={data.productos.map((p) => [
                <span key="c" className="font-mono text-[13px]">{p.item_code}</span>,
                <span key="d" className="text-slate-600 dark:text-ink-300">{p.item_desc}</span>,
                fmtQty(p.unidades),
                fmtMoney(p.facturado, "ARS"),
              ])} />
            </Card>
            <Card title="Top 10 clientes">
              <TablaTop cols={["Cliente", "Comp.", "Facturado"]} rows={data.clientes.map((c) => [
                <span key="cl" className="text-slate-700 dark:text-ink-200">{c.cliente || "—"}</span>,
                fmtQty(c.comprobantes),
                fmtMoney(c.facturado, "ARS"),
              ])} />
            </Card>
          </div>
        </div>
      )}
    </PanelPage>
  );
}

export default function VentasCanalPage() {
  return (
    <Suspense fallback={<PanelPage title="Ventas por canal" />}>
      <VentasCanalInner />
    </Suspense>
  );
}
