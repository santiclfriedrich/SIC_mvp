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
        flex items-center gap-3 bg-transparent border-2 border-[#0D1829] rounded-2xl
        px-5 transition-all duration-200
        hover:bg-[#E4E3E0] focus-within:bg-[#E4E3E0]
        focus-within:shadow-[0_0_0_3px_rgba(13,24,41,0.18)]
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
          flex-1 bg-transparent text-[#1A1917] placeholder-[#8A8A8A]
          outline-none
          ${isLarge ? "text-base" : "text-sm"}
        `}
      />

      <button
        onClick={onSearch}
        aria-label="Buscar"
        className="
          flex-shrink-0 text-[#0D1829] hover:text-[#1B2C49]
          transition-colors duration-150 active:scale-95 cursor-pointer
        "
      >
        <Search size={isLarge ? 22 : 18} strokeWidth={2.5} />
      </button>
    </div>
  );
};
