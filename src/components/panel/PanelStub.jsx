export function PanelStub({ title, note }) {
  return (
    <div className="p-6 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-ink-100">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-ink-400">
          {note || "Pantalla del panel en migración — próximamente con datos reales de la base unificada."}
        </p>
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white/50 p-10 text-center text-sm text-slate-400 dark:border-ink-700 dark:bg-ink-900/40 dark:text-ink-500">
          En construcción
        </div>
      </div>
    </div>
  );
}
