"use client";

import SmartImage from "../SmartImage/SmartImage";

export const ProductCard = ({ product, onClick }) => {

const best = product.bestPrice || product.providers?.[0] || product;
const stock = Number(best.stockTotal ?? best.stock ?? product.stockTotal ?? product.stock) || 0;

  const provider = best.provider ?? product.provider ?? "Proveedor";
  const price = Number(best.price ?? product.price) || 0;
  const currency = best.currency || product.currency || "USD";
  const iva = best.iva || product.iva || "IVA";


  const hasComparison =
    Array.isArray(product.providers) && product.providers.length > 1;

  // 🖼 Imagen: prioridad → imagen real del mejor precio → imagen real de cualquier proveedor → imagen default
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

  // 🎨 Estilos por proveedor (SIN CAMBIOS)
  const providerStyles = {
    Elit: {
      badge: "bg-orange-100 text-orange-800",
      hoverBorder: "hover:border-orange-400",
    },
    Nucleo: {
      badge: "bg-red-100 text-red-800",
      hoverBorder: "hover:border-red-400",
    },
    PCArts: {
      badge: "bg-violet-100 text-violet-800",
      hoverBorder: "hover:border-violet-400",
    },
    Masnet: {
      badge: "bg-blue-100 text-blue-800",
      hoverBorder: "hover:border-blue-400",
    },
    Corcisa: {
      badge: "bg-sky-100 text-sky-800",
      hoverBorder: "hover:border-sky-400",
    },
    SolutionBox: {
      badge: "text-white",
      hoverBorder: "hover:border-[#e31e24]",
      badgeBg: "#e31e24",
      imageBg: "#2b2d32",
    },
    Invid: {
      badge: "text-white",
      hoverBorder: "hover:border-[#009ee2]",
      badgeBg: "#009ee2",
    },
    AIR: {
      badge: "text-white",
      hoverBorder: "hover:border-[#1B3A6B]",
      badgeBg: "#1B3A6B",
    },
    Microglobal: {
      badge: "text-white",
      hoverBorder: "hover:border-[#1a7f37]",
      badgeBg: "#1a7f37",
    },
  };

  const style =
    providerStyles[provider] || {
      badge: "bg-gray-100 text-gray-700",
      hoverBorder: "hover:border-gray-300",
    };

  // 📦 Estado de stock (SIN CAMBIOS)
  const getStockStatus = (stock) => {
    if (stock > 20) return "disponible";
    if (stock > 0) return "limitado";
    return "bajo";
  };

  const stockStatus = getStockStatus(stock);

  const getStockColor = (status) => {
    if (status === "disponible") return "bg-green-100 text-green-800";
    if (status === "limitado") return "bg-yellow-100 text-yellow-800";
    if (status === "bajo") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-white rounded-2xl
        shadow-sm hover:shadow-lg
        transition-all duration-200
        cursor-pointer overflow-hidden
        border border-transparent
        ${style.hoverBorder}
      `}
    >
      {/* 🏷 Provider badge */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${style.badge}`}
          style={style.badgeBg ? { backgroundColor: style.badgeBg } : undefined}
        >
          {provider}
        </span>

        {hasComparison && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800">
            {product.providers.length} proveedores
          </span>
        )}
      </div>

{/* 🖼 Imagen */}
<div
  className="relative h-40 w-full rounded-t-2xl border-b"
  style={{ backgroundColor: style.imageBg ?? "#ffffff" }}
>
  {displayImage ? (
    <SmartImage
      src={displayImage}
      alt={product.name}
      fill
      sizes="(max-width: 768px) 100vw, 25vw"
      className="object-contain p-4"
      loading="lazy"
    />
  ) : (
    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100" />
  )}
</div>


      {/* ℹ Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 text-sm">
          {product.name}
        </h3>

        <p className="text-xs text-gray-500 mb-2">
          SKU: <span className="font-mono">{product.sku}</span>
        </p>

        {/* 💰 Precio */}
        <div className="mb-3">
          <p className="text-2xl font-bold text-gray-900">
            {currency}{" "}
            {price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>

          <p className="text-xs text-gray-500">
            + IVA {iva}
            {hasComparison && (
              <span className="ml-1 text-green-600">
                · Mejor precio
              </span>
            )}
          </p>
        </div>

        {/* 📦 Stock */}
        <div className="flex items-center justify-between">
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${getStockColor(
              stockStatus
            )}`}
          >
            Stock {stockStatus}: {stock}
          </span>
        </div>

        {/* 🏭 Marca */}
        {product.brand && (
          <p className="text-xs text-gray-500 mt-2">
            Marca: {product.brand}
          </p>
        )}
      </div>
    </div>
  );
};
