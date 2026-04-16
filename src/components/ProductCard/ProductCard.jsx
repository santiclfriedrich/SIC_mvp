"use client";

import SmartImage from "../SmartImage/SmartImage";

const PROVIDER_STYLES = {
  Elit:        { color: "#ea6c1a", badge: "bg-orange-50 text-orange-700", imageBg: "#fff" },
  Nucleo:      { color: "#dc2626", badge: "bg-red-50 text-red-700",       imageBg: "#fff" },
  PCArts:      { color: "#7c3aed", badge: "bg-violet-50 text-violet-700", imageBg: "#fff" },
  Masnet:      { color: "#2563eb", badge: "bg-blue-50 text-blue-700",     imageBg: "#fff" },
  Corcisa:     { color: "#0ea5e9", badge: "bg-sky-50 text-sky-700",       imageBg: "#fff" },
  SolutionBox: { color: "#e31e24", badge: "bg-red-600 text-white",        imageBg: "#2b2d32" },
  Invid:       { color: "#009ee2", badge: "bg-[#009ee2] text-white",      imageBg: "#fff" },
  AIR:         { color: "#1B3A6B", badge: "bg-[#1B3A6B] text-white",     imageBg: "#fff" },
  Microglobal: { color: "#1a7f37", badge: "bg-[#1a7f37] text-white",     imageBg: "#fff" },
  Distecna:    { color: "#0d9488", badge: "bg-teal-600 text-white",       imageBg: "#fff" },
};

const STOCK_STYLES = {
  disponible: { label: (n) => `${n} en stock`,   cls: "bg-emerald-50 text-emerald-700" },
  limitado:   { label: (n) => `${n} últimos`,    cls: "bg-amber-50 text-amber-700"     },
  agotado:    { label: ()  => "Sin stock",        cls: "bg-red-50 text-red-600"         },
};

function getStockKey(n) {
  if (n > 20) return "disponible";
  if (n > 0)  return "limitado";
  return "agotado";
}

export const ProductCard = ({ product, onClick }) => {
  const best      = product.bestPrice || product.providers?.[0] || product;
  const stock     = Number(best.stockTotal ?? best.stock ?? product.stockTotal ?? product.stock) || 0;
  const provider  = best.provider ?? product.provider ?? "Proveedor";
  const price     = Number(best.price ?? product.price) || 0;
  const currency  = best.currency || product.currency || "USD";
  const iva       = best.iva || product.iva || "IVA";
  const hasComparison = Array.isArray(product.providers) && product.providers.length > 1;

  function isRealImage(img) {
    return typeof img === "string" && img.startsWith("http");
  }
  const displayImage = (() => {
    if (isRealImage(best?.image)) return best.image;
    if (Array.isArray(product.providers)) {
      const found = product.providers.find((p) => isRealImage(p.image));
      if (found) return found.image;
    }
    return best?.image ?? product.image ?? null;
  })();

  const style     = PROVIDER_STYLES[provider] || { color: "#9B978F", badge: "bg-gray-50 text-gray-600", imageBg: "#fff" };
  const stockKey  = getStockKey(stock);
  const stockInfo = STOCK_STYLES[stockKey];

  return (
    <div
      onClick={onClick}
      className="relative bg-white rounded-xl cursor-pointer overflow-hidden border border-[#E3E1DC] hover:border-[#C8C5BE] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-0.5 group"
      style={{ borderLeftColor: style.color, borderLeftWidth: "3px" }}
    >
      {/* Imagen */}
      <div
        className="relative h-44 w-full overflow-hidden border-b border-[#F0EEEA]"
        style={{ backgroundColor: style.imageBg }}
      >
        {displayImage ? (
          <SmartImage
            src={displayImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#F2F1EE] to-[#E8E6E0]" />
        )}

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold leading-5 ${style.badge}`}>
            {provider}
          </span>
          {hasComparison && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              {product.providers.length} proveedores
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="font-semibold text-[#1A1917] text-[13px] line-clamp-2 leading-snug mb-1.5">
          {product.name}
        </h3>

        <p className="text-[11px] text-[#9B978F] font-mono mb-3 tracking-wide">
          {product.sku}
        </p>

        {/* Precio */}
        <div className="mb-3">
          <div className="flex items-baseline gap-1">
            <span className="text-[11px] font-medium text-[#9B978F]">{currency}</span>
            <span className="text-[1.35rem] font-bold text-[#1A1917] tracking-tight leading-none">
              {price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-[#9B978F] mt-0.5">
            + IVA {iva}
            {hasComparison && (
              <span className="ml-1 text-emerald-600 font-medium">· mejor precio</span>
            )}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#F0EEEA]">
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${stockInfo.cls}`}>
            {stockInfo.label(stock)}
          </span>
          {product.brand && (
            <span className="text-[11px] text-[#9B978F] truncate max-w-[90px]">
              {product.brand}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
