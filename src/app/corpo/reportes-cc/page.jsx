import Link from "next/link";
import { ReportePreviewClient } from "./ReportePreviewClient";

export default function ReportesCcPage() {
  return (
    <main className="min-h-screen bg-[#F2F1EE] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-semibold text-[#1A1917]">Reportes CC</h1>
          <Link
            href="/corpo"
            className="text-sm text-[#9B978F] hover:text-[#1A1917]"
          >
            ← Volver
          </Link>
        </div>
        <p className="text-sm text-[#9B978F] mb-8">
          Cuentas corrientes — subí el export crudo del ERP para obtener su formato correspondiente junto a un Dashboard de Resumen
        </p>

        <ReportePreviewClient />
      </div>
    </main>
  );
}
