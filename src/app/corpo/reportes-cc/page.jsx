import Link from "next/link";
import { ReportePreviewClient } from "./ReportePreviewClient";

export default function ReportesCcPage() {
  return (
    <main className="min-h-screen bg-[#F2F1EE]">
      {/* Hero gradiente */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1F4E78] to-[#2E75B6] text-white">
        {/* Decoración */}
        <div className="absolute -right-10 -top-10 opacity-[0.08] pointer-events-none">
          <svg width="280" height="280" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
          </svg>
        </div>

        <div className="max-w-6xl mx-auto px-8 py-8 relative">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 inline-flex">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                  <line x1="15" y1="3" x2="15" y2="9" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                  Reporte automatizado
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Reportes de Cuentas Corrientes
                </h1>
              </div>
            </div>

            <Link
              href="/corpo"
              className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur text-sm font-medium transition flex items-center gap-1.5 flex-shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Volver
            </Link>
          </div>

          <p className="text-sm text-white/80 max-w-2xl pl-[60px]">
            Subí el export crudo del ERP para obtener su formato correspondiente
            junto a un Dashboard de Resumen.
          </p>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-6xl mx-auto px-8 py-8">
        <ReportePreviewClient />
      </div>
    </main>
  );
}
