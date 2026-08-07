// Encabezado de página del panel (título + subtítulo + acciones), replicando
// el header del Layout de bi-stock. El shell (sidebar/topbar) lo pone AppShell.
export function PanelPage({ title, subtitle, actions, children }) {
  return (
    <div className="flex h-full flex-col">
      {(title || actions) && (
        <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-900 sm:px-6 lg:px-8 lg:py-4">
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-white lg:text-xl">{title}</h1>
              {subtitle && <p className="hidden truncate text-sm text-slate-500 dark:text-ink-300 sm:block">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
          </div>
        </header>
      )}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
