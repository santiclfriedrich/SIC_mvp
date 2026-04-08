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


/**
 * 🎨 Colores por proveedor
 */
const PROVIDER_STYLES = {
  Elit: { badge: "bg-orange-100 text-orange-800" },
  Nucleo: { badge: "bg-red-100 text-red-800" },
  PCArts: { badge: "bg-violet-100 text-violet-800" },
  Masnet: { badge: "bg-blue-100 text-blue-800" },
  Corcisa: { badge: "bg-sky-100 text-sky-800" },
  SolutionBox: { badge: "text-white", badgeBg: "#e31e24" },
  Invid:       { badge: "text-white", badgeBg: "#009ee2" },
  AIR:         { badge: "text-white", badgeBg: "#1B3A6B" },
  Microglobal: { badge: "text-white", badgeBg: "#1a7f37" },
};

export const ProductModal = ({ product, onClose }) => {
  const [copied, setCopied] = useState(false);

  /* -------------------- DATA -------------------- */
  const providers = useMemo(() => {
    if (!product) return [];
    return product.providers?.length ? product.providers : [product];
  }, [product]);

  const { best, ahorro } = useMemo(() => {
    if (providers.length < 2) {
      return { best: providers[0], ahorro: 0 };
    }

    const sorted = [...providers].sort((a, b) => a.price - b.price);
    return {
      best: sorted[0],
      ahorro: sorted.at(-1).price - sorted[0].price,
    };
  }, [providers]);

  if (!product || !best) return null;

  const imageUrl =
    product.image ||
    "https://via.placeholder.com/400x300?text=Sin+Imagen";

  const bestStyle =
    PROVIDER_STYLES[best.provider] || {
      badge: "bg-gray-100 text-gray-700",
    };

  /* -------------------- HELPERS -------------------- */
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
      ? "bg-green-100 text-green-800"
      : stock > 0
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800";

  /* -------------------- UI -------------------- */
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-sm ${bestStyle.badge}`}
              style={bestStyle.badgeBg ? { backgroundColor: bestStyle.badgeBg } : undefined}
            >
              {best.provider}
            </span>

            {providers.length > 1 && (
              <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 flex items-center gap-1">
                <Trophy size={14} />
                Mejor precio
              </span>
            )}
          </div>

          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={22} />
          </button>
        </div>

        {/* INFO PRINCIPAL */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* IMAGE */}
        <div className="bg-gray-50 rounded-xl p-6">
          <div className="relative w-full h-80 md:h-[420px]">
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


          {/* INFO */}
          <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h2>

            {/* SKU */}
            <div className="flex items-center gap-2 mb-5">
            <span className="text-sm font-medium text-gray-900">SKU</span>
            <span className="px-3 py-1 bg-gray-100 rounded-md font-mono text-gray-900">
                {product.sku}
              </span>
              <button onClick={handleCopySku}>
                {copied ? (
                  <Check size={16} className="text-green-600" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>

            {/* CARD DE PRECIO — SIEMPRE VERDE */}
            <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-300">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
              <Trophy size={14} className="text-green-700" />
              Mejor precio disponible
            </p>


              <p className="text-3xl font-bold text-gray-900">
                USD{" "}
                {best.price.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </p>

              <p className="text-sm text-gray-800 mb-2">
                + IVA {best.iva}
              </p>

              <span
                className={`px-3 py-1 rounded-md text-sm ${stockBadge(
                  best.stockTotal
                )}`}
              >
                Disponible · {best.stockTotal} unidades
              </span>
            </div>

            {ahorro > 0 && (
              <p className="text-gray-900 text-sm flex items-center gap-1">
                <TrendingDown size={14} className="text-green-700" />
                Ahorro: USD{" "}
                {ahorro.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </p>
            )}
          </div>
        </div>

        {/* COMPARATIVA — INTACTA */}
        {providers.length > 1 && (
          <div className="px-6 pb-6">
            <h3 className="font-semibold mb-3 text-gray-900">
              Comparación de precios{" "}
              <span className="text-sm text-black">
                ({providers.length} proveedores)
              </span>
            </h3>

            <div className="flex items-center justify-between gap-4 px-4 py-3 text-xs text-black font-medium border-b border-gray-100">
              <div className="min-w-[140px]">Proveedor</div>
              <div className="min-w-[90px]">SKU</div>
              <div className="min-w-[140px] text-right">Precio</div>
              <div className="min-w-[90px] text-right">Stock</div>
              <div className="min-w-[40px] text-center">Link</div>
            </div>

            <div className="space-y-3 pt-3">
              {providers.map((p) => {
                const style = PROVIDER_STYLES[p.provider] || {};
                const isBest = best.provider === p.provider;

                return (
                  <div
                    key={p.provider}
                    className={`flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 ${
                      isBest ? "bg-green-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="min-w-[140px] flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${style.badge}`}
                        style={style.badgeBg ? { backgroundColor: style.badgeBg } : undefined}
                      >
                        {p.provider}
                      </span>
                      {isBest && (
                        <Trophy size={14} className="text-green-600" />
                      )}
                    </div>

                    <div className="min-w-[90px] font-mono text-xs text-black">
                      {product.sku}
                    </div>

                    <div className="min-w-[140px] text-right">
                      <p className="font-semibold text-gray-900">
                        USD{" "}
                        {p.price.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-xs text-black">
                        + IVA {p.iva}
                      </p>
                    </div>

                    <div className="min-w-[90px] text-right">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-medium ${stockBadge(
                          p.stockTotal
                        )}`}
                      >
                        {p.stockTotal} un.
                      </span>
                    </div>

                    <div className="min-w-[40px] text-center">
                      {p.link ? (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink size={18} />
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex justify-end gap-4 p-6 border-t border-gray-100">
          <button onClick={onClose} className="text-black">
            Cerrar
          </button>

          {best.link && (
            <a
              href={best.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              Ir al mejor precio
              <ExternalLink size={18} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
