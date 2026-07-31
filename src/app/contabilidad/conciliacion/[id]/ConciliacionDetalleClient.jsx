"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function formatARS(n) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n || 0);
}

function formatFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function ConciliacionDetalleClient({ data }) {
  const [tab, setTab] = useState("sheet"); // "sheet" | "resumen"

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
    <main
      className="flex flex-col bg-[#F2F1EE] overflow-hidden"
      style={{ height: "calc(100vh - 57px)", overscrollBehavior: "contain" }}
    >
      <div className="bg-white border-b border-black/[0.06] flex-shrink-0">
        <div className="px-6 flex items-end justify-between gap-6 flex-wrap">
          <div className="flex items-end gap-8 min-w-0 flex-wrap">
            <div className="min-w-0 pt-3 pb-3">
              <h1 className="text-xl font-semibold text-[#1A1917] truncate">
                Conciliación GBP ↔ MercadoPago
              </h1>
              <p className="text-[11px] text-[#9B978F] truncate">
                {formatFecha(data.createdAt)} · {data.fuente} · {data.user?.name || data.user?.email}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <TabButton active={tab === "sheet"} onClick={() => setTab("sheet")}>Planilla</TabButton>
              <TabButton active={tab === "resumen"} onClick={() => setTab("resumen")}>Resumen</TabButton>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 py-3">
            <a
              href={data.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-[#059669] text-white text-sm font-medium hover:bg-[#047857] transition flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Abrir en otra pestaña
            </a>
            <Link
              href="/contabilidad/conciliacion"
              className="px-4 py-2 rounded-lg border border-[#EF4444]/30 text-[#EF4444] text-sm font-medium hover:bg-[#FEE2E2] transition"
            >
              ← Volver
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "sheet" ? (
          <iframe
            src={data.embedUrl}
            title="Conciliación MP"
            className="w-full h-full block"
            style={{ border: 0 }}
          />
        ) : (
          <div className="h-full overflow-auto px-6 py-6">
            <div className="max-w-[1000px] mx-auto space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Kpi label="COBRADAS" value={data.cobradas} sub={formatARS(data.montoCobrado)} color="#059669" />
                <Kpi label="PENDIENTES" value={data.pendientes} sub={formatARS(data.montoPendiente)} color="#D97706" />
                <Kpi label="MP SIN GBP" value={data.sobrantes} sub={formatARS(data.montoSobrante)} color="#DC2626" />
                <Kpi label="OPERACIONES GBP" value={data.gbpOps} color="#065F46" />
                <Kpi label="GBP SIN N° OP" value={data.resumen?.gbpSinOp ?? "—"} color="#6B7280" />
                <Kpi label="OPERACIONES MP" value={data.resumen?.mpOps ?? "—"} color="#065F46" />
              </div>
              <p className="text-sm text-[#9B978F]">
                El detalle completo (cada operación) está en la planilla. Usá la solapa{" "}
                <strong>Planilla</strong> o abrí el Sheet en otra pestaña.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "relative px-5 py-3 text-sm font-semibold transition flex items-center gap-2 -mb-px border-b-2 " +
        (active
          ? "border-[#059669] text-[#059669]"
          : "border-transparent text-[#6B7280] hover:text-[#1A1917] hover:bg-[#F8F9FA]")
      }
    >
      {children}
    </button>
  );
}

function Kpi({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-black/[0.06] p-4">
      <p className="text-[10px] font-medium tracking-widest uppercase text-[#9B978F]">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-[#9B978F] mt-0.5">{sub}</p>}
    </div>
  );
}
