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
        flex items-center bg-white border border-[#E3E1DC] rounded-xl
        shadow-sm transition-all duration-200
        focus-within:border-[#2563EB] focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]
        ${isLarge ? "h-14" : "h-11"}
      `}
    >
      <Search
        size={isLarge ? 18 : 16}
        className="ml-4 text-[#9B978F] flex-shrink-0"
        strokeWidth={2}
      />

      <input
        type="text"
        placeholder={isLarge ? "Código o nombre del producto…" : "Buscar producto…"}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`
          flex-1 px-3 bg-transparent text-[#1A1917] placeholder-[#9B978F]
          outline-none
          ${isLarge ? "text-base" : "text-sm"}
        `}
      />

      <button
        onClick={onSearch}
        className={`
          mr-2 flex-shrink-0 bg-[#1D4ED8] hover:bg-[#1e40af] text-white
          rounded-lg font-medium transition-all duration-150
          active:scale-95 cursor-pointer
          ${isLarge ? "px-5 h-10 text-sm" : "px-4 h-8 text-xs"}
        `}
      >
        Buscar
      </button>
    </div>
  );
};
