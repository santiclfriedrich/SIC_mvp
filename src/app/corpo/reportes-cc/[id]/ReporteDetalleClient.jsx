"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function formatARS(n) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function formatFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ReporteDetalleClient({ data }) {
  const [tab, setTab] = useState("sheet"); // "sheet" | "dashboard"

  // Bloquea el scroll del body sólo mientras esta página está montada,
  // así el scroll del mouse vive exclusivamente dentro del iframe.
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  return (
    // h-screen menos el alto del Header global (56px = h-14 + 1px de border)
    <main
      className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-ink-950"
      style={{ overscrollBehavior: "contain" }}
    >
      {/* Header: título + tabs + botones, todo en una fila */}
      <div className="bg-white dark:bg-ink-900 border-b border-slate-200 dark:border-ink-700 flex-shrink-0">
        <div className="px-6 flex items-end justify-between gap-6 flex-wrap">
          <div className="flex items-end gap-8 min-w-0 flex-wrap">
            <div className="min-w-0 pt-3 pb-3">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-ink-100 truncate">
                Reporte de Cuentas Corrientes
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-ink-400 truncate">
                {formatFecha(data.createdAt)} · {data.fuente} · {data.user?.name || data.user?.email}
              </p>
            </div>

            {/* Tabs alineadas al borde inferior del header */}
            <div className="flex items-center gap-1">
              <TabButton active={tab === "sheet"} onClick={() => setTab("sheet")} icon="sheet">
                Planilla
              </TabButton>
              <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon="dashboard">
                Dashboard
              </TabButton>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 py-3">
            <a
              href={data.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-sm font-medium hover:bg-[#6D28D9] transition flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Abrir en otra pestaña
            </a>
            <Link
              href="/corpo/reportes-cc"
              className="px-4 py-2 rounded-lg border border-[#EF4444]/30 text-[#EF4444] text-sm font-medium hover:bg-[#FEE2E2] transition"
            >
              ← Volver
            </Link>
          </div>
        </div>
      </div>

      {/* Contenido — ocupa TODO el espacio restante; scroll vive acá dentro */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "sheet" ? (
          <iframe
            src={data.embedUrl}
            title="Reporte CC"
            className="w-full h-full block"
            style={{ border: 0 }}
          />
        ) : (
          <div className="h-full overflow-auto px-6 py-6">
            <div className="max-w-[1600px] mx-auto">
              <DashboardView data={data} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function TabButton({ active, onClick, children, icon }) {
  return (
    <button
      onClick={onClick}
      className={
        "relative px-5 py-3 text-sm font-semibold transition flex items-center gap-2 -mb-px border-b-2 " +
        (active
          ? "border-brand-600 dark:border-brand-400 text-brand-600 dark:text-brand-300"
          : "border-transparent text-slate-500 dark:text-ink-400 hover:text-slate-900 dark:hover:text-ink-100 hover:bg-slate-50 dark:hover:bg-ink-800")
      }
    >
      {icon === "sheet" && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      )}
      {icon === "dashboard" && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      )}
      {children}
    </button>
  );
}

function DashboardView({ data }) {
  const promedio = data.totalClientes > 0 ? data.totalDeuda / data.totalClientes : 0;
  const top10 = data.clientes.slice(0, 10);
  const maxSaldo = Math.max(...top10.map((c) => c.saldoTotal || 0), 1);
  const totalVendedor = data.porVendedor.reduce((acc, v) => acc + v.saldo, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="TOTAL DEUDA" value={formatARS(data.totalDeuda)} color="#C00000" />
        <Kpi label="CLIENTES" value={data.totalClientes} color="#1F4E78" />
        <Kpi label="COMPROBANTES" value={data.totalComp} color="#1F4E78" />
        <Kpi label="PROMEDIO / CLIENTE" value={formatARS(promedio)} color="#385723" />
      </div>

      <div className="bg-white dark:bg-ink-900 rounded-xl border border-slate-200 dark:border-ink-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-ink-700 bg-slate-100 dark:bg-ink-800">
          <h3 className="font-semibold text-[#1F4E78] dark:text-brand-300">TOP 10 DEUDORES</h3>
        </div>
        <div className="p-5 space-y-2">
          {top10.map((c) => {
            const pct = ((c.saldoTotal || 0) / maxSaldo) * 100;
            return (
              <div key={c.numero} className="flex items-center gap-3">
                <div className="w-48 text-sm text-slate-900 dark:text-ink-100 truncate" title={c.nombre}>
                  {c.nombre}
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-ink-950 rounded h-6 relative overflow-hidden">
                  <div
                    className="bg-[#2E75B6] h-full rounded transition-all"
                    style={{ width: pct + "%" }}
                  />
                </div>
                <div className="w-32 text-right text-sm font-medium text-slate-900 dark:text-ink-100 tabular-nums">
                  {formatARS(c.saldoTotal)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-ink-900 rounded-xl border border-slate-200 dark:border-ink-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-ink-700 bg-slate-100 dark:bg-ink-800">
          <h3 className="font-semibold text-[#1F4E78] dark:text-brand-300">DEUDA POR VENDEDOR</h3>
        </div>
        <div className="p-5 space-y-2">
          {data.porVendedor.map((v) => {
            const pct = (v.saldo / totalVendedor) * 100;
            return (
              <div key={v.vendedor} className="flex items-center gap-3">
                <div className="w-64 text-sm text-slate-900 dark:text-ink-100 truncate" title={v.vendedor}>
                  {v.vendedor}
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-ink-950 rounded h-5 relative overflow-hidden">
                  <div
                    className="bg-[#385723] h-full rounded transition-all"
                    style={{ width: pct + "%" }}
                  />
                </div>
                <div className="w-12 text-right text-xs text-slate-500 dark:text-ink-400 tabular-nums">
                  {pct.toFixed(1)}%
                </div>
                <div className="w-32 text-right text-sm font-medium text-slate-900 dark:text-ink-100 tabular-nums">
                  {formatARS(v.saldo)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }) {
  return (
    <div className="bg-white dark:bg-ink-900 rounded-xl border border-slate-200 dark:border-ink-700 p-4">
      <p className="text-[10px] font-medium tracking-widest uppercase text-slate-500 dark:text-ink-400">
        {label}
      </p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
