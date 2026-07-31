import Link from "next/link";
import { ConciliacionClient } from "./ConciliacionClient";

export default function ConciliacionPage() {
  return (
    <main className="min-h-screen bg-[#F2F1EE]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#065F46] to-[#059669] text-white">
        <div className="absolute -right-10 -top-10 opacity-[0.08] pointer-events-none">
          <svg width="280" height="280" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 3v18h18v-2H5V3H3zm4 12h2v-5H7v5zm4 0h2V7h-2v8zm4 0h2v-3h-2v3z" />
          </svg>
        </div>

        <div className="max-w-6xl mx-auto px-8 py-8 relative">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 inline-flex">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 3h5v5" />
                  <path d="M8 21H3v-5" />
                  <path d="M21 3l-7.5 7.5" />
                  <path d="M3 21l7.5-7.5" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                  Cruce automatizado
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Conciliación GBP ↔ MercadoPago
                </h1>
              </div>
            </div>

            <Link
              href="/contabilidad"
              className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur text-sm font-medium transition flex items-center gap-1.5 flex-shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Volver
            </Link>
          </div>

          <p className="text-sm text-white/80 max-w-2xl pl-[60px]">
            Subí el Excel con las hojas <strong>gbp</strong>, <strong>argcol</strong>,{" "}
            <strong>kanji</strong> y <strong>ganga</strong>. Se cruza por N° de operación y se
            genera un Sheet con cobradas, pendientes y cobros de MP sin correlato en GBP.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        <ConciliacionClient />
      </div>
    </main>
  );
}
