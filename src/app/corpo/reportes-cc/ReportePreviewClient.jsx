"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function formatARS(n) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function formatFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ReportePreviewClient() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportes, setReportes] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    fetch("/api/corpo/reportes-cc")
      .then((r) => r.json())
      .then((j) => setReportes(j.reportes || []))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/corpo/reportes-cc", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al procesar");
        setLoading(false);
      } else {
        router.push(`/corpo/reportes-cc/${json.id}`);
      }
    } catch (err) {
      setError("Error de red: " + err.message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-black/[0.06] p-6"
      >
        <label className="block text-sm font-medium text-[#1A1917] mb-2">
          Subir reporte crudo del ERP (.xls / .xlsx)
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={loading}
            className="text-sm text-[#1A1917] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#E5E7EB] file:text-[#1A1917] hover:file:bg-[#D1D5DB] file:cursor-pointer"
          />
          <button
            type="submit"
            disabled={!file || loading}
            className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Generando reporte…" : "Generar reporte"}
          </button>
        </div>
        <p className="text-xs text-[#9B978F] mt-2">
          Procesa el archivo, crea el Google Sheet con las 3 hojas formateadas y lo
          guarda en tu historial. Puede tardar 10-20 segundos.
        </p>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Historial */}
      <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-black/[0.06]">
          <h3 className="font-semibold text-[#1A1917]">Reportes generados</h3>
        </div>
        {loadingList ? (
          <div className="p-6 text-sm text-[#9B978F]">Cargando…</div>
        ) : reportes.length === 0 ? (
          <div className="p-6 text-sm text-[#9B978F]">
            Todavía no generaste ningún reporte. Subí un archivo para empezar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F9FA] text-[#595959]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Fecha</th>
                  <th className="text-left px-4 py-2 font-medium">Fuente</th>
                  <th className="text-left px-4 py-2 font-medium">Generado por</th>
                  <th className="text-center px-4 py-2 font-medium">Clientes</th>
                  <th className="text-center px-4 py-2 font-medium">Comprob.</th>
                  <th className="text-right px-4 py-2 font-medium">Total deuda</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {reportes.map((r, i) => (
                  <tr
                    key={r.id}
                    className={i % 2 === 1 ? "bg-[#F8F9FA]" : "bg-white"}
                  >
                    <td className="px-4 py-2 text-[#595959] whitespace-nowrap">
                      {formatFecha(r.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-[#1A1917]">{r.fuente}</td>
                    <td className="px-4 py-2 text-[#595959]">{r.user?.name || r.user?.email}</td>
                    <td className="px-4 py-2 text-center text-[#595959]">{r.totalClientes}</td>
                    <td className="px-4 py-2 text-center text-[#595959]">{r.totalComp}</td>
                    <td className="px-4 py-2 text-right font-medium text-[#1A1917]">
                      {formatARS(r.totalDeuda)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/corpo/reportes-cc/${r.id}`}
                        className="text-[#2563EB] hover:underline text-xs font-medium"
                      >
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
