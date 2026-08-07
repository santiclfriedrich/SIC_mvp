"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const handleChange = (page) => {
    onPageChange(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
  const btnActive = "bg-brand-600 text-white border-brand-600";
  const btnInactive =
    "bg-white text-slate-900 border-slate-200 hover:border-slate-300 dark:bg-ink-900 dark:text-ink-100 dark:border-ink-700 dark:hover:border-ink-600";
  const arrowBtn =
    "p-2 rounded-lg border border-slate-200 bg-white text-slate-900 transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-35 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:hover:border-ink-600";

  return (
    <div className="mb-2 mt-8 flex flex-wrap items-center justify-center gap-1">
      <button
        onClick={() => handleChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={arrowBtn}
        aria-label="Página anterior"
      >
        <ChevronLeft size={15} />
      </button>

      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`dots-${i}`} className="select-none px-1 text-sm text-slate-400 dark:text-ink-400">
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

      <button
        onClick={() => handleChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={arrowBtn}
        aria-label="Página siguiente"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
};
