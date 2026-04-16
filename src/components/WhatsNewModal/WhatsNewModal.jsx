"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, LayoutGrid, ArrowUpDown, ImageIcon, Type, Zap, Package } from "lucide-react";

const SESSION_KEY = "whats_new_v3_seen";

const FEATURES = [
  {
    icon: Package,
    title: "Catálogo completo al ingresar",
    desc: "Todos los productos de los 10 proveedores se cargan automáticamente al loguearte, sin necesidad de buscar.",
  },
  {
    icon: LayoutGrid,
    title: "Paginado",
    desc: "48 productos por página para una navegación más rápida y fluida.",
  },
  {
    icon: ArrowUpDown,
    title: "Filtros de ordenamiento",
    desc: "Ordená por mayor stock, menor stock, sin stock, A → Z o Z → A.",
  },
  {
    icon: ImageIcon,
    title: "Lógica inteligente de imágenes",
    desc: "Prioriza la imagen real del producto. Si no hay, usa la imagen del proveedor como fallback.",
  },
  {
    icon: Type,
    title: "Nueva tipografía",
    desc: "Work Sans en toda la interfaz para una lectura más clara y moderna.",
  },
  {
    icon: Zap,
    title: "10 proveedores integrados",
    desc: "Elit, Nucleo, PCArts, Masnet, Corcisa, SolutionBox, Invid, AIR, Microglobal y Distecna.",
  },
];

export const WhatsNewModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(13, 24, 41, 0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl px-6 pt-6 pb-4 border-b border-[#F0EEEA]">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-[#9B978F] hover:bg-[#F2F1EE] hover:text-[#1A1917] transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 pr-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#EFF6FF]">
              <Sparkles size={20} className="text-[#2563EB]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1A1917]">Novedades</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#2563EB] text-white">
                  v3.0
                </span>
              </div>
              <p className="text-xs text-[#9B978F] mt-0.5">Argentina Color · Compras</p>
            </div>
          </div>
        </div>

        {/* Features list */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3.5">
              <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[#F2F1EE]">
                <Icon size={15} className="text-[#2563EB]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1A1917] leading-snug">{title}</p>
                <p className="text-xs text-[#9B978F] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl bg-[#1A1917] text-white text-sm font-semibold hover:bg-[#2d2b28] transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
