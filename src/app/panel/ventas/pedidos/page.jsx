import { Hammer, ClipboardList } from "lucide-react";
import { PanelPage } from "@/components/panel/PanelPage";

export default function PedidosPage() {
  return (
    <PanelPage title="Pedidos" subtitle="Circuito de ventas por estado (Área Comercial, OK Emisión, Pendientes)">
      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300">
        <Hammer size={16} className="shrink-0" />
        <span><b>Sección en construcción.</b> Estamos conectando los datos de pedidos del ERP.</span>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-ink-700 dark:bg-ink-900/40">
        <ClipboardList size={32} className="mx-auto mb-3 text-slate-300 dark:text-ink-500" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-ink-100">Pedidos por estado</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-ink-300">
          Acá vas a ver los pedidos separados por estado del circuito, cada uno con su total, cantidad y detalle, con filtros por vendedor, tipo de documento y fecha.
        </p>
      </div>
    </PanelPage>
  );
}
