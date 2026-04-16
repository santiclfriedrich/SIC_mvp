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
      <ArrowUpDown size={14} className="text-[#9B978F] shrink-0" />
      <span className="text-xs text-[#9B978F] font-medium whitespace-nowrap hidden sm:inline">
        Ordenar:
      </span>
      <select
        value={sortBy}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs bg-white border border-[#E3E1DC] rounded-lg px-3 py-1.5 text-[#1A1917] font-medium cursor-pointer hover:border-[#C8C5BE] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors appearance-none pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239B978F%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[center_right_0.5rem]"
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
