import Link from "next/link";
import { PreciosClient } from "./PreciosClient";

export default function PreciosPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-ink-950">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0F766E] to-[#14B8A6] text-white">
        <div className="absolute -right-10 -top-10 opacity-[0.08] pointer-events-none">
          <svg width="280" height="280" viewBox="0 0 24 24" fill="currentColor">
            <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-8 py-8 relative">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 inline-flex">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                  Pricing automatizado
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Precios por tienda
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/tiendas/ajustes"
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur text-sm font-medium transition flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Ajustes
              </Link>
              <Link
                href="/tiendas"
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur text-sm font-medium transition flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Volver
              </Link>
            </div>
          </div>

          <p className="text-sm text-white/80 max-w-2xl pl-[60px]">
            Subí el report21 para enriquecer SKUs, seteá precios con la renta en
            vivo y exportá los precios finales.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        <PreciosClient />
      </div>
    </main>
  );
}
