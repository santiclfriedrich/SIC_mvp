import { compact } from "@/lib/panel/format";

export function HBars({ rows, fmt = (v) => compact(v) }) {
  if (!rows || !rows.length) {
    return <div className="py-6 text-center text-sm text-slate-400 dark:text-ink-500">Sin datos todavía.</div>;
  }
  const max = Math.max(...rows.map((r) => Number(r.valor) || 0), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => {
        const v = Number(r.valor) || 0;
        const pct = Math.max(0.5, (v / max) * 100);
        return (
          <div
            key={`${r.label}-${i}`}
            className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3"
            title={`${r.label}: ${fmt(v, r)}`}
          >
            <div className="truncate text-sm text-slate-600 dark:text-ink-200">{r.label}</div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-ink-800">
              <div className="h-2 rounded-full bg-brand-600 dark:bg-brand-300" style={{ width: `${pct}%` }} />
            </div>
            <div className="whitespace-nowrap text-right text-sm font-medium tabular-nums text-slate-900 dark:text-ink-100">
              {fmt(v, r)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
