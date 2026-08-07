"use client";
import { Search } from "lucide-react";

export const SearchBar = ({ searchQuery, setSearchQuery, onSearch, variant = "large" }) => {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") onSearch();
  };

  const isLarge = variant === "large";

  return (
    <div
      className={`
        flex items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-5
        transition-all duration-200 dark:border-ink-600 dark:bg-ink-900
        hover:border-slate-400 focus-within:border-brand-500
        focus-within:ring-2 focus-within:ring-brand-500/20 dark:hover:border-ink-500
        ${isLarge ? "h-14" : "h-11"}
      `}
    >
      <input
        type="text"
        placeholder="Buscar productos…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`
          flex-1 bg-transparent text-slate-900 outline-none placeholder-slate-400
          dark:text-ink-100 dark:placeholder-ink-400
          ${isLarge ? "text-base" : "text-sm"}
        `}
      />

      <button
        onClick={onSearch}
        aria-label="Buscar"
        className="flex-shrink-0 cursor-pointer text-brand-600 transition-colors duration-150 hover:text-brand-700 active:scale-95 dark:text-brand-300"
      >
        <Search size={isLarge ? 22 : 18} strokeWidth={2.5} />
      </button>
    </div>
  );
};
