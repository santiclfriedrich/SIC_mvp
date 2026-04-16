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
      ? "bg-emerald-50 text-emerald-700"
      : stock > 0
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-600";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#F2F1EE] w-full sm:max-w-5xl sm:w-full max-h-[96vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >

        {/* HEADER STICKY */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#F2F1EE] border-b border-[#E3E1DC] sticky top-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${bestStyle.badge}`}
              style={bestStyle.badgeBg ? { backgroundColor: bestStyle.badgeBg } : undefined}
            >
              {best.provider}
            </span>
            {providers.length > 1 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1 flex-shrink-0">
                <Trophy size={11} />
                Mejor precio
              </span>
            )}
            <span className="text-sm font-medium text-[#625F5A] truncate hidden sm:block ml-1">
              {product.name}
            </span>
          </div>

          <button
            onClick={onClose}
            className="ml-3 flex-shrink-0 p-1.5 hover:bg-[#E3E1DC] rounded-lg transition-colors text-[#625F5A] hover:text-[#1A1917]"
          >
            <X size={18} />
          </button>
        </div>

        {/* CUERPO PRINCIPAL */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Imagen */}
          <div className="bg-white rounded-xl border border-[#E3E1DC] p-5 flex items-center justify-center min-h-[240px]"
               style={{ backgroundColor: best.provider === "SolutionBox" ? "#2b2d32" : "#fff" }}>
            <div className="relative w-full h-64 md:h-80">
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

            {/* Nombre */}
            <div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-[#1A1917] leading-tight mb-2 tracking-tight"
              >
                {product.name}
              </h2>

              {/* SKU */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#9B978F]">SKU</span>
                <span className="px-2.5 py-0.5 bg-white border border-[#E3E1DC] rounded-md font-mono text-sm text-[#1A1917]">
                  {product.sku}
                </span>
                <button
                  onClick={handleCopySku}
                  className="p-1 hover:bg-[#E3E1DC] rounded-md transition-colors text-[#9B978F] hover:text-[#1A1917]"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Precio principal */}
            <div
              className="bg-white rounded-xl border p-4"
              style={{ borderColor: bestStyle.color + "40", borderLeftColor: bestStyle.color, borderLeftWidth: "3px" }}
            >
              <p className="text-xs font-medium text-[#9B978F] flex items-center gap-1.5 mb-2">
                <Trophy size={12} className="text-emerald-600" />
                Mejor precio disponible
              </p>

              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-sm font-medium text-[#9B978F]">USD</span>
                <span className="text-3xl font-bold text-[#1A1917] tracking-tight">
                  {best.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <p className="text-xs text-[#9B978F] mb-3">+ IVA {best.iva}</p>

              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${stockBadge(best.stockTotal)}`}>
                {best.stockTotal > 0 ? `${best.stockTotal} unidades disponibles` : "Sin stock"}
              </span>
            </div>

            {ahorro > 0 && (
              <p className="text-sm text-[#625F5A] flex items-center gap-1.5">
                <TrendingDown size={14} className="text-emerald-600" />
                Ahorrás{" "}
                <span className="font-semibold text-[#1A1917]">
                  USD {ahorro.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </span>{" "}
                vs el más caro
              </p>
            )}

            {/* CTA */}
            {best.link && (
              <a
                href={best.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1e40af] text-white text-sm font-medium transition-all duration-150 active:scale-[0.98]"
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
            <h3 className="text-sm font-semibold text-[#1A1917] mb-3">
              Comparación de precios{" "}
              <span className="font-normal text-[#9B978F]">· {providers.length} proveedores</span>
            </h3>

            {/* Scroll horizontal en mobile */}
            <div className="overflow-x-auto rounded-xl border border-[#E3E1DC]">
              <table className="w-full min-w-[520px] text-sm bg-white">
                <thead>
                  <tr className="border-b border-[#E3E1DC] bg-[#F8F7F5]">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#9B978F] uppercase tracking-wide">Proveedor</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#9B978F] uppercase tracking-wide">SKU</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#9B978F] uppercase tracking-wide">Precio</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#9B978F] uppercase tracking-wide">Stock</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#9B978F] uppercase tracking-wide">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p, i) => {
                    const ps = PROVIDER_STYLES[p.provider] || {};
                    const isBest = best.provider === p.provider;
                    return (
                      <tr
                        key={`${p.provider}-${i}`}
                        className={`border-b border-[#F0EEEA] last:border-0 transition-colors ${
                          isBest ? "bg-emerald-50/60" : "hover:bg-[#F8F7F5]"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${ps.badge || "bg-gray-50 text-gray-600"}`}
                              style={ps.badgeBg ? { backgroundColor: ps.badgeBg } : undefined}
                            >
                              {p.provider}
                            </span>
                            {isBest && <Trophy size={12} className="text-emerald-500" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#625F5A]">{product.sku}</td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-[#1A1917]">
                            USD {p.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[11px] text-[#9B978F]">+ IVA {p.iva}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${stockBadge(p.stockTotal)}`}>
                            {p.stockTotal} un.
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.link ? (
                            <a
                              href={p.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#2563EB] hover:text-[#1D4ED8] transition-colors inline-flex"
                            >
                              <ExternalLink size={16} />
                            </a>
                          ) : (
                            <span className="text-[#C8C5BE]">—</span>
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
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-[#E3E1DC]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#625F5A] hover:text-[#1A1917] hover:bg-[#E3E1DC] rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
