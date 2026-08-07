"use client";
import { SearchBar } from "../SearchBar/SearchBar";

const PROVIDERS = [
  "Elit", "Nucleo", "PCArts", "Masnet", "Corcisa",
  "SolutionBox", "Invid", "AIR", "Microglobal", "Distecna",
];

export const LandingPage = ({ searchQuery, setSearchQuery, onSearch, compact = false }) => {
  return (
    <div
      className={
        compact
          ? "mx-auto w-full max-w-4xl px-4 pb-8 pt-10 text-center"
          : "flex min-h-[70vh] items-center justify-center"
      }
    >
      <div className={compact ? "" : "mx-auto w-full max-w-4xl px-4 py-16 text-center sm:py-20"}>
        <h1 className="mb-5 text-2xl font-extrabold leading-snug tracking-wide text-slate-900 dark:text-ink-100 sm:text-3xl">
          Buscá y compará todos los proveedores.
        </h1>

        {!compact && (
          <p className="mx-auto mb-10 max-w-md text-base leading-relaxed text-slate-600 dark:text-ink-300 sm:text-lg">
            Precios, stock y condiciones en tiempo real para tomar la mejor decisión de compra.
          </p>
        )}

        <div className={compact ? "mb-0" : "mb-10"}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={onSearch}
            variant="large"
          />
        </div>

        {!compact && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {PROVIDERS.map((p) => (
              <span
                key={p}
                className="select-none rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400"
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
