"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const handleChange = (page) => {
    onPageChange(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Build visible page numbers with ellipsis
  const buildPages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (range[0] > 2) range.unshift("...");
    if (range[range.length - 1] < totalPages - 1) range.push("...");

    rangeWithDots.push(1);
    range.forEach((r) => rangeWithDots.push(r));
    if (totalPages > 1) rangeWithDots.push(totalPages);

    return rangeWithDots;
  };

  const pages = buildPages();

  const btnBase =
    "min-w-[2rem] h-8 px-2 rounded-lg text-[13px] font-medium transition-colors border";
  const btnActive = "bg-[#2563EB] text-white border-[#2563EB]";
  const btnInactive =
    "bg-white text-[#1A1917] border-[#E3E1DC] hover:border-[#C8C5BE]";

  return (
    <div className="flex items-center justify-center gap-1 mt-8 mb-2 flex-wrap">
      {/* Prev */}
      <button
        onClick={() => handleChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border border-[#E3E1DC] bg-white text-[#1A1917] disabled:opacity-35 disabled:cursor-not-allowed hover:border-[#C8C5BE] transition-colors"
        aria-label="Página anterior"
      >
        <ChevronLeft size={15} />
      </button>

      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`dots-${i}`} className="px-1 text-sm text-[#9B978F] select-none">
            …
          </span>
        ) : (
          <button
            key={page}
            onClick={() => handleChange(page)}
            className={`${btnBase} ${page === currentPage ? btnActive : btnInactive}`}
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => handleChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg border border-[#E3E1DC] bg-white text-[#1A1917] disabled:opacity-35 disabled:cursor-not-allowed hover:border-[#C8C5BE] transition-colors"
        aria-label="Página siguiente"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
};
