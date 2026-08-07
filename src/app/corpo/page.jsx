import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function CorpoHome() {
  // Datos vivos para que el card "se sienta" como un reporte real
  const [count, ultimo] = await Promise.all([
    prisma.reporteCC.count(),
    prisma.reporteCC.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, totalDeuda: true },
    }),
  ]);

  const formatARS = (n) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);

  const formatFecha = (d) =>
    d
      ? new Date(d).toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

  return (
    <main className="p-6 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-ink-100 mb-2">Panel Corpo</h1>
        <p className="text-sm text-slate-500 dark:text-ink-400 mb-8">
          Herramientas internas para reportes corporativos.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/corpo/reportes-cc"
            className="group relative block rounded-2xl overflow-hidden bg-gradient-to-br from-[#1F4E78] to-[#2E75B6] text-white p-7 hover:shadow-xl hover:shadow-[#1F4E78]/20 transition-all duration-200"
          >
            {/* Decoración de fondo */}
            <div className="absolute -right-6 -top-6 opacity-[0.08] pointer-events-none">
              <svg width="180" height="180" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
              </svg>
            </div>

            <div className="relative">
              {/* Icono + label superior */}
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 inline-flex">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                    <line x1="15" y1="3" x2="15" y2="9" />
                  </svg>
                </div>
                <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                  Reporte automatizado
                </div>
              </div>

              {/* Título */}
              <h2 className="text-2xl font-bold mb-1">Reportes de Cuentas Corrientes</h2>
              <p className="text-sm text-white/80 mb-6 max-w-md">
                Generá el reporte formateado de Cta Cte de Clientes desde el export del ERP, con resumen, detalle y dashboard incluido.
              </p>

              {/* Stats vivas */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                  <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                    Reportes generados
                  </div>
                  <div className="text-2xl font-bold mt-0.5">{count}</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                  <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                    Último
                  </div>
                  <div className="text-2xl font-bold mt-0.5">
                    {formatFecha(ultimo?.createdAt)}
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="inline-flex items-center gap-2 text-sm font-semibold bg-white text-[#1F4E78] px-4 py-2 rounded-lg group-hover:gap-3 transition-all">
                {count === 0 ? "Generar primer reporte" : "Abrir reportes"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>

              {/* Total acumulado abajo si hay reportes */}
              {ultimo && (
                <div className="mt-6 pt-5 border-t border-white/15 text-xs text-white/70">
                  Última deuda reportada:{" "}
                  <span className="font-semibold text-white">{formatARS(ultimo.totalDeuda)}</span>
                </div>
              )}
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
