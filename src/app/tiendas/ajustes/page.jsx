import Link from "next/link";
import { AjustesClient } from "./AjustesClient";

export default function AjustesPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-ink-950">
      <div className="bg-gradient-to-br from-[#0F766E] to-[#14B8A6] text-white">
        <div className="max-w-5xl mx-auto px-8 py-7 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
              Configuración
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Ajustes de tiendas</h1>
          </div>
          <Link
            href="/tiendas/precios"
            className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur text-sm font-medium transition flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Volver
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <AjustesClient />
      </div>
    </main>
  );
}
