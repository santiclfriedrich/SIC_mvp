"use client";

import { ArrowUpDown } from "lucide-react";

const SORT_OPTIONS = [
  { value: "stock-desc", label: "Mayor stock" },
  { value: "stock-asc",  label: "Menor stock" },
  { value: "no-stock",   label: "Sin stock"   },
  { value: "a-z",        label: "A → Z"       },
  { value: "z-a",        label: "Z → A"       },
];

export const SortFilter = ({ sortBy, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown size={14} className="shrink-0 text-slate-400 dark:text-ink-400" />
      <span className="hidden whitespace-nowrap text-xs font-medium text-slate-500 dark:text-ink-400 sm:inline">
        Ordenar:
      </span>
      <select
        value={sortBy}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:hover:border-ink-600"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
