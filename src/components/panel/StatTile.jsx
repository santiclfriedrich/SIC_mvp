export function StatTile({ label, value, hint, tone = "default", className = "" }) {
  const valueClass =
    tone === "warn"
      ? "text-orange-600 dark:text-orange-400"
      : tone === "bad"
        ? "text-red-600 dark:text-red-400"
        : tone === "good"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-slate-900 dark:text-ink-100";
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900 ${className}`}>
      <div className="truncate text-xs font-medium text-slate-500 dark:text-ink-400">{label}</div>
      <div className={`mt-1 whitespace-nowrap text-xl font-semibold tracking-tight tabular-nums ${valueClass}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-slate-400 dark:text-ink-500">{hint}</div>}
    </div>
  );
}
