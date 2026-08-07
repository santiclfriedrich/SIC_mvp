export function Card({ title, subtitle, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900 ${className}`}>
      {title && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-ink-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-ink-400">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
