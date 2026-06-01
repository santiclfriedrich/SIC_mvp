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
  const [deleting, setDeleting] = useState(null); // id en proceso de borrado
  const [confirmDelete, setConfirmDelete] = useState(null); // reporte a confirmar

  async function cargarReportes() {
    setLoadingList(true);
    try {
      const r = await fetch("/api/corpo/reportes-cc");
      const j = await r.json();
      setReportes(j.reportes || []);
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    cargarReportes();
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

  async function handleDelete(id) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/corpo/reportes-cc/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert("Error al borrar: " + (j.error || res.statusText));
      } else {
        // Saca el reporte de la lista local sin recargar todo
        setReportes((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (e) {
      alert("Error de red: " + e.message);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
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
            className="px-5 py-2 rounded-lg bg-gradient-to-br from-[#1F4E78] to-[#2E75B6] text-white text-sm font-medium hover:shadow-lg hover:shadow-[#1F4E78]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Generando reporte…" : "Generar reporte"}
          </button>
        </div>
        <p className="text-xs text-[#9B978F] mt-2">
          El reporte puede demorar de 10 a 20 segundos en generarse.
        </p>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Historial */}
      <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-[#1F4E78] to-[#2E75B6] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="15" y2="17" />
            </svg>
            <h3 className="font-semibold">Reportes generados</h3>
            <span className="text-xs text-white/70 ml-1">({reportes.length})</span>
          </div>
          <button
            onClick={cargarReportes}
            disabled={loadingList}
            className="text-xs text-white/80 hover:text-white disabled:opacity-50 flex items-center gap-1 bg-white/10 hover:bg-white/20 backdrop-blur px-2.5 py-1 rounded-md transition"
            title="Sincronizar nombres con Drive"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {loadingList ? "Sincronizando…" : "Sincronizar"}
          </button>
        </div>
        {loadingList && reportes.length === 0 ? (
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
                  <th className="text-left px-4 py-2 font-medium">Nombre del archivo</th>
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
                    <td className="px-4 py-2">
                      {r.nombreArchivo ? (
                        <a
                          href={r.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1A1917] hover:text-[#2563EB] hover:underline font-medium inline-flex items-center gap-1"
                          title="Abrir en Drive"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                          </svg>
                          {r.nombreArchivo}
                        </a>
                      ) : (
                        <span className="text-[#9B978F] italic">Archivo eliminado en Drive</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[#595959] text-xs">{r.fuente}</td>
                    <td className="px-4 py-2 text-[#595959]">{r.user?.name || r.user?.email}</td>
                    <td className="px-4 py-2 text-center text-[#595959]">{r.totalClientes}</td>
                    <td className="px-4 py-2 text-center text-[#595959]">{r.totalComp}</td>
                    <td className="px-4 py-2 text-right font-medium text-[#1A1917]">
                      {formatARS(r.totalDeuda)}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/corpo/reportes-cc/${r.id}`}
                          className="text-[#2563EB] hover:underline text-xs font-medium"
                        >
                          Abrir →
                        </Link>
                        <button
                          onClick={() => setConfirmDelete(r)}
                          disabled={deleting === r.id}
                          className="text-[#EF4444] hover:text-[#DC2626] disabled:opacity-50"
                          title="Borrar reporte"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de confirmación de borrado */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => deleting === null && setConfirmDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl border border-black/[0.06] p-6 max-w-md w-full"
          >
            <h3 className="text-lg font-semibold text-[#1A1917] mb-2">
              ¿Borrar este reporte?
            </h3>
            <p className="text-sm text-[#595959] mb-1">
              <strong>{confirmDelete.nombreArchivo || confirmDelete.fuente}</strong>
            </p>
            <p className="text-xs text-[#9B978F] mb-5">
              Se envía el archivo a la papelera del Shared Drive (es recuperable durante 30 días) y se quita del historial.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting !== null}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#595959] hover:bg-[#F8F9FA] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                disabled={deleting !== null}
                className="px-4 py-2 rounded-lg bg-[#EF4444] text-white text-sm font-medium hover:bg-[#DC2626] disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Borrando…" : "Borrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
