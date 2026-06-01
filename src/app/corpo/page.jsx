import Link from "next/link";

export default function CorpoHome() {
  return (
    <main className="min-h-screen bg-[#F2F1EE] p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-semibold text-[#1A1917] mb-2">Panel Corpo</h1>
        <p className="text-sm text-[#9B978F] mb-8">
          Herramientas internas para reportes corporativos.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/corpo/reportes-cc"
            className="block p-5 bg-white rounded-xl border border-black/[0.06] hover:border-[#2563EB]/30 hover:shadow-sm transition"
          >
            <h2 className="font-semibold text-[#1A1917]">Reportes CC</h2>
            <p className="text-sm text-[#9B978F] mt-1">
              Generar reportes de Cta Cte de Clientes desde el export del ERP.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
