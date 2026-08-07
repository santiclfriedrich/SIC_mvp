"use client";

import {
  X,
  Copy,
  Check,
  ExternalLink,
  Trophy,
  TrendingDown,
} from "lucide-react";
import { useState, useMemo } from "react";
import SmartImage from "../SmartImage/SmartImage";

const PROVIDER_STYLES = {
  Elit:        { badge: "bg-orange-50 text-orange-700",  color: "#ea6c1a" },
  Nucleo:      { badge: "bg-red-50 text-red-700",        color: "#dc2626" },
  PCArts:      { badge: "bg-violet-50 text-violet-700",  color: "#7c3aed" },
  Masnet:      { badge: "bg-blue-50 text-blue-700",      color: "#2563eb" },
  Corcisa:     { badge: "bg-sky-50 text-sky-700",        color: "#0ea5e9" },
  SolutionBox: { badge: "bg-red-600 text-white",         color: "#e31e24" },
  Invid:       { badge: "text-white",                    color: "#009ee2", badgeBg: "#009ee2" },
  AIR:         { badge: "text-white",                    color: "#1B3A6B", badgeBg: "#1B3A6B" },
  Microglobal: { badge: "text-white",                    color: "#1a7f37", badgeBg: "#1a7f37" },
  Distecna:    { badge: "bg-teal-600 text-white",        color: "#0d9488" },
};

export const ProductModal = ({ product, onClose }) => {
  const [copied, setCopied] = useState(false);

  const providers = useMemo(() => {
    if (!product) return [];
    return product.providers?.length ? product.providers : [product];
  }, [product]);

  const { best, ahorro } = useMemo(() => {
    if (providers.length < 2) return { best: providers[0], ahorro: 0 };
    const sorted = [...providers].sort((a, b) => a.price - b.price);
    return { best: sorted[0], ahorro: sorted.at(-1).price - sorted[0].price };
  }, [providers]);

  if (!product || !best) return null;

  function isRealImage(img) {
    return typeof img === "string" && img.startsWith("http");
  }
  const imageUrl = (() => {
    if (isRealImage(best?.image)) return best.image;
    const found = providers.find((p) => isRealImage(p.image));
    if (found) return found.image;
    return best?.image ?? product.image ?? null;
  })();

  const bestStyle = PROVIDER_STYLES[best.provider] || { badge: "bg-gray-50 text-gray-600", color: "#9B978F" };

  const handleCopySku = async () => {
    try {
      await navigator.clipboard.writeText(product.sku);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Error copiando SKU", e);
    }
  };

  const stockBadge = (stock) =>
    stock > 20
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : stock > 0
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[96vh] w-full overflow-y-auto rounded-t-2xl bg-slate-50 shadow-2xl dark:bg-ink-950 sm:max-h-[90vh] sm:w-full sm:max-w-5xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >

        {/* HEADER STICKY */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-ink-700 dark:bg-ink-950">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`flex-shrink-0 rounded-full px-3 py-0.5 text-xs font-semibold ${bestStyle.badge}`}
              style={bestStyle.badgeBg ? { backgroundColor: bestStyle.badgeBg } : undefined}
            >
              {best.provider}
            </span>
            {providers.length > 1 && (
              <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Trophy size={11} />
                Mejor precio
              </span>
            )}
            <span className="ml-1 hidden truncate text-sm font-medium text-slate-600 dark:text-ink-300 sm:block">
              {product.name}
            </span>
          </div>

          <button
            onClick={onClose}
            className="ml-3 flex-shrink-0 rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* CUERPO PRINCIPAL */}
        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">

          {/* Imagen */}
          <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900"
               style={{ backgroundColor: best.provider === "SolutionBox" ? "#2b2d32" : undefined }}>
            <div className="relative h-64 w-full md:h-80">
              <SmartImage
                src={imageUrl}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Detalles */}
          <div className="flex flex-col gap-4">

            <div>
              <h2 className="mb-2 text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-ink-100 sm:text-3xl">
                {product.name}
              </h2>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 dark:text-ink-400">SKU</span>
                <span className="rounded-md border border-slate-200 bg-white px-2.5 py-0.5 font-mono text-sm text-slate-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100">
                  {product.sku}
                </span>
                <button
                  onClick={handleCopySku}
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div
              className="rounded-xl border bg-white p-4 dark:bg-ink-900"
              style={{ borderColor: bestStyle.color + "40", borderLeftColor: bestStyle.color, borderLeftWidth: "3px" }}
            >
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-ink-400">
                <Trophy size={12} className="text-emerald-600" />
                Mejor precio disponible
              </p>

              <div className="mb-1 flex items-baseline gap-1.5">
                <span className="text-sm font-medium text-slate-400 dark:text-ink-400">USD</span>
                <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-ink-100">
                  {best.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <p className="mb-3 text-xs text-slate-400 dark:text-ink-400">+ IVA {best.iva}</p>

              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${stockBadge(best.stockTotal)}`}>
                {best.stockTotal > 0 ? `${best.stockTotal} unidades disponibles` : "Sin stock"}
              </span>
            </div>

            {ahorro > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-ink-300">
                <TrendingDown size={14} className="text-emerald-600" />
                Ahorrás{" "}
                <span className="font-semibold text-slate-900 dark:text-ink-100">
                  USD {ahorro.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </span>{" "}
                vs el más caro
              </p>
            )}

            {best.link && (
              <a
                href={best.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98]"
              >
                Ir al mejor precio
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        </div>

        {/* TABLA COMPARATIVA */}
        {providers.length > 1 && (
          <div className="px-5 pb-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-ink-100">
              Comparación de precios{" "}
              <span className="font-normal text-slate-400 dark:text-ink-400">· {providers.length} proveedores</span>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-700">
              <table className="w-full min-w-[520px] bg-white text-sm dark:bg-ink-900">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-ink-700 dark:bg-ink-800">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-ink-400">Proveedor</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-ink-400">SKU</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-ink-400">Precio</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-ink-400">Stock</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-ink-400">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p, i) => {
                    const ps = PROVIDER_STYLES[p.provider] || {};
                    const isBest = best.provider === p.provider;
                    return (
                      <tr
                        key={`${p.provider}-${i}`}
                        className={`border-b border-slate-100 transition-colors last:border-0 dark:border-ink-800 ${
                          isBest ? "bg-emerald-50/60 dark:bg-emerald-950/30" : "hover:bg-slate-50 dark:hover:bg-ink-800"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ps.badge || "bg-gray-50 text-gray-600"}`}
                              style={ps.badgeBg ? { backgroundColor: ps.badgeBg } : undefined}
                            >
                              {p.provider}
                            </span>
                            {isBest && <Trophy size={12} className="text-emerald-500" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-ink-300">{product.sku}</td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-slate-900 dark:text-ink-100">
                            USD {p.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-ink-400">+ IVA {p.iva}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${stockBadge(p.stockTotal)}`}>
                            {p.stockTotal} un.
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.link ? (
                            <a
                              href={p.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-300"
                            >
                              <ExternalLink size={16} />
                            </a>
                          ) : (
                            <span className="text-slate-300 dark:text-ink-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-ink-700">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-100"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
