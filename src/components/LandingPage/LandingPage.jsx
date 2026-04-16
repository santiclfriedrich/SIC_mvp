"use client";
import { SearchBar } from '../SearchBar/SearchBar';

const PROVIDERS = [
  "Elit", "Nucleo", "PCArts", "Masnet", "Corcisa",
  "SolutionBox", "Invid", "AIR", "Microglobal", "Distecna",
];

export const LandingPage = ({ searchQuery, setSearchQuery, onSearch, compact = false }) => {
  return (
    <div
      className={
        compact
          ? "w-full max-w-4xl mx-auto px-4 pt-10 pb-8 text-center"
          : "flex items-center justify-center min-h-[calc(100vh-3.5rem)]"
      }
    >
      <div className={compact ? "" : "w-full max-w-4xl mx-auto px-4 py-16 sm:py-20 text-center"}>

        {/* Headline */}
        <h1
          className="text-2xl sm:text-3xl text-[#1A1917] mb-5 leading-snug font-extrabold tracking-wide"
          style={{ fontFamily: "var(--font-display, sans-serif)" }}
        >
          Todos los proveedores,{" "}
          <span className="text-[#2563EB]">una sola búsqueda.</span>
        </h1>

        {!compact && (
          <p className="text-base sm:text-lg text-[#625F5A] mb-10 max-w-md mx-auto leading-relaxed">
            Precios, stock y condiciones en tiempo real para tomar la mejor decisión de compra.
          </p>
        )}

        {/* SearchBar */}
        <div className={compact ? "mb-0" : "mb-10"}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={onSearch}
            variant="large"
          />
        </div>

        {/* Providers pills — only in full mode */}
        {!compact && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {PROVIDERS.map((p) => (
              <span
                key={p}
                className="px-3 py-1 rounded-full text-[11px] font-medium bg-white border border-[#E3E1DC] text-[#9B978F] shadow-sm select-none"
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
