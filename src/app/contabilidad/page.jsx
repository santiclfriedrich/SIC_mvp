import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ContabilidadHome() {
  const [count, ultimo] = await Promise.all([
    prisma.conciliacionMP.count(),
    prisma.conciliacionMP.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, cobradas: true, pendientes: true },
    }),
  ]);

  const formatFecha = (d) =>
    d
      ? new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "—";

  return (
    <main className="min-h-screen bg-[#F2F1EE] p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-semibold text-[#1A1917] mb-2">Panel Contabilidad</h1>
        <p className="text-sm text-[#9B978F] mb-8">
          Herramientas de conciliación y control de cobros.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/contabilidad/conciliacion"
            className="group relative block rounded-2xl overflow-hidden bg-gradient-to-br from-[#065F46] to-[#059669] text-white p-7 hover:shadow-xl hover:shadow-[#065F46]/20 transition-all duration-200"
          >
            <div className="absolute -right-6 -top-6 opacity-[0.08] pointer-events-none">
              <svg width="180" height="180" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3v18h18v-2H5V3H3zm4 12h2v-5H7v5zm4 0h2V7h-2v8zm4 0h2v-3h-2v3z" />
              </svg>
            </div>

            <div className="relative">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 inline-flex">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 3h5v5" />
                    <path d="M8 21H3v-5" />
                    <path d="M21 3l-7.5 7.5" />
                    <path d="M3 21l7.5-7.5" />
                  </svg>
                </div>
                <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                  Cruce automatizado
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-1">Conciliación GBP ↔ MercadoPago</h2>
              <p className="text-sm text-white/80 mb-6 max-w-md">
                Subí el Excel con las hojas gbp / argcol / kanji / ganga y obtené el cruce:
                qué operaciones de GBP se cobraron en MercadoPago, cuáles siguen pendientes y
                qué cobros de MP no están en GBP.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                  <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                    Conciliaciones
                  </div>
                  <div className="text-2xl font-bold mt-0.5">{count}</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                  <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                    Última
                  </div>
                  <div className="text-2xl font-bold mt-0.5">{formatFecha(ultimo?.createdAt)}</div>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 text-sm font-semibold bg-white text-[#065F46] px-4 py-2 rounded-lg group-hover:gap-3 transition-all">
                {count === 0 ? "Generar primer cruce" : "Abrir conciliaciones"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>

              {ultimo && (
                <div className="mt-6 pt-5 border-t border-white/15 text-xs text-white/70">
                  Último cruce:{" "}
                  <span className="font-semibold text-white">{ultimo.cobradas} cobradas</span> ·{" "}
                  <span className="font-semibold text-white">{ultimo.pendientes} pendientes</span>
                </div>
              )}
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
