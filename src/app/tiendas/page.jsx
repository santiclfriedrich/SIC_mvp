import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function TiendasHome() {
  const [count, ultimoUpload] = await Promise.all([
    prisma.pricingProduct.count().catch(() => 0),
    prisma.report21Upload.findUnique({ where: { id: 1 } }).catch(() => null),
  ]);

  const formatFecha = (d) =>
    d
      ? new Date(d).toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

  return (
    <main className="min-h-screen bg-[#F2F1EE] p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-semibold text-[#1A1917] mb-2">Panel Tiendas</h1>
        <p className="text-sm text-[#9B978F] mb-8">
          Pricing para tiendas: seteá precios y mirá la renta en vivo, sin planilla.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/tiendas/precios"
            className="group relative block rounded-2xl overflow-hidden bg-gradient-to-br from-[#0F766E] to-[#14B8A6] text-white p-7 hover:shadow-xl hover:shadow-[#0F766E]/20 transition-all duration-200"
          >
            <div className="absolute -right-6 -top-6 opacity-[0.08] pointer-events-none">
              <svg width="180" height="180" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h18v4H3zM5 9h14v12H5zm4 4h6v2H9z" />
              </svg>
            </div>

            <div className="relative">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 inline-flex">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                  Pricing automatizado
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-1">Precios por tienda</h2>
              <p className="text-sm text-white/80 mb-6 max-w-md">
                Subí el report21, seteá precios (manual o &quot;auto&quot; 4–5%),
                exportá a Excel y a Google Sheets.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                  <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                    SKUs priceados
                  </div>
                  <div className="text-2xl font-bold mt-0.5">{count}</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                  <div className="text-[10px] font-medium tracking-widest uppercase text-white/60">
                    Último report21
                  </div>
                  <div className="text-2xl font-bold mt-0.5">
                    {formatFecha(ultimoUpload?.createdAt)}
                  </div>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 text-sm font-semibold bg-white text-[#0F766E] px-4 py-2 rounded-lg group-hover:gap-3 transition-all">
                {count === 0 ? "Empezar" : "Abrir precios"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
