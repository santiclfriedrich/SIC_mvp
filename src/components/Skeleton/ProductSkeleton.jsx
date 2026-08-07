export const ProductSkeleton = () => (
  <div className="animate-pulse overflow-hidden rounded-xl border border-l-4 border-slate-200 border-l-slate-200 bg-white dark:border-ink-700 dark:border-l-ink-700 dark:bg-ink-900">
    <div className="h-44 bg-slate-100 dark:bg-ink-800" />

    <div className="space-y-3 p-3.5">
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-slate-200 dark:bg-ink-800" />
        <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-ink-800" />
      </div>

      <div className="h-2.5 w-1/3 rounded bg-slate-100 dark:bg-ink-700" />

      <div>
        <div className="mb-1 h-6 w-1/2 rounded bg-slate-200 dark:bg-ink-800" />
        <div className="h-2.5 w-1/4 rounded bg-slate-100 dark:bg-ink-700" />
      </div>

      <div className="flex justify-between border-t border-slate-100 pt-2.5 dark:border-ink-800">
        <div className="h-5 w-20 rounded-full bg-slate-100 dark:bg-ink-700" />
        <div className="h-5 w-14 rounded bg-slate-100 dark:bg-ink-700" />
      </div>
    </div>
  </div>
);
