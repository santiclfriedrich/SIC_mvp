"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingDown, TrendingUp, Hammer } from "lucide-react";
import { PanelPage } from "@/components/panel/PanelPage";
import { DateRangePicker } from "@/components/panel/DateRangePicker";
import { VentasDetalleTabla } from "@/components/panel/VentasDetalleTabla";
import { fmtDec, fmtMoney, fmtQty } from "@/lib/panel/format";

function VarBadge({ v, prevLbl, prev }) {
  if (v == null) return <span className="text-xs text-slate-400 dark:text-ink-500">sin dato {prevLbl}</span>;
  const up = v >= 0;
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
        {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {fmtDec(Math.abs(v))}%
      </span>
      <span className="text-slate-400 dark:text-ink-500">vs {prevLbl} · {fmtMoney(prev, "ARS")}</span>
    </span>
  );
}

const SUCURSALES = [
  { value: "", label: "Todas" },
  { value: "arg", label: "ARG Color" },
  { value: "skop", label: "SKOP Trader" },
];

export default function VentasPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rango, setRango] = useState(null);
  const [sucursal, setSucursal] = useState("");
  const [activaClave, setActivaClave] = useState(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(false);
    fetch("/api/panel/ventas/resumen")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (!cancel) { setData(j); setLoading(false); } })
      .catch(() => { if (!cancel) { setError(true); setLoading(false); } });
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (data?.ref && !rango) {
      setRango({ desde: data.ref, hasta: data.ref });
      const hoy = data.cards.find((c) => c.desde === data.ref && c.hasta === data.ref);
      setActivaClave(hoy?.clave ?? null);
    }
  }, [data, rango]);

  let body;
  if (loading) {
    body = (
      <div className="grid animate-pulse grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (<div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-ink-900" />))}
      </div>
    );
  } else if (error || !data || !data.cards.length) {
    body = (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-ink-700 dark:bg-ink-900/40">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-ink-100">Sin datos de ventas todavía</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-ink-300">Se están cargando desde el ERP.</p>
      </div>
    );
  } else {
    const verCard = (c) => { setRango({ desde: c.desde, hasta: c.hasta }); setActivaClave(c.clave); };
    const cambiarRango = (r) => {
      setRango(r);
      const m = data.cards.find((c) => c.desde === r.desde && c.hasta === r.hasta);
      setActivaClave(m?.clave ?? null);
    };
    const verCanal = (clave) => router.push(`/panel/ventas/canal/${clave.toLowerCase()}?p=mes`);
    const activa = (c) => c.clave === activaClave;

    body = (
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-500 dark:text-ink-400">Comparativas</h3>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {data.cards.map((c) => (
              <button key={c.clave} onClick={() => verCard(c)} className={`flex flex-col items-start gap-2 rounded-2xl border bg-white p-4 text-left transition-colors dark:bg-ink-900 ${activa(c) ? "border-brand-300 bg-brand-50/50 dark:border-brand-400/50 dark:bg-ink-800" : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/40 dark:border-ink-700 dark:hover:border-ink-600 dark:hover:bg-ink-800"}`}>
                <div className="text-xs font-medium text-slate-500 dark:text-ink-400">{c.titulo}</div>
                <div className="text-xl font-semibold tracking-tight text-slate-900 dark:text-ink-100">{fmtMoney(c.facturado, "ARS")}</div>
                <VarBadge v={c.var} prevLbl={c.prev_titulo} prev={c.prev} />
                <div className="text-xs text-slate-400 dark:text-ink-500">{fmtQty(c.comprobantes)} comprobantes</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-500 dark:text-ink-400">Por canal · este mes</h3>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {data.canales.map((c) => (
              <button key={c.clave} onClick={() => verCanal(c.clave)} className="flex flex-col items-start gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-ink-600 dark:hover:bg-ink-800">
                <div className="text-xs font-medium text-slate-500 dark:text-ink-400">{c.titulo}</div>
                <div className="text-xl font-semibold tracking-tight text-slate-900 dark:text-ink-100">{fmtMoney(c.facturado, "ARS")}</div>
                <div className="text-xs text-slate-400 dark:text-ink-500">este mes</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-ink-400">Detalle de ventas</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-ink-700 dark:bg-ink-800/60">
                {SUCURSALES.map((s) => (
                  <button key={s.value} onClick={() => setSucursal(s.value)} className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${sucursal === s.value ? "bg-white text-brand-700 shadow-sm dark:bg-ink-900 dark:text-brand-300" : "text-slate-500 hover:text-slate-800 dark:text-ink-400 dark:hover:text-ink-100"}`}>{s.label}</button>
                ))}
              </div>
              <DateRangePicker value={rango} onChange={cambiarRango} anchor={data.ref} />
            </div>
          </div>
          {rango && <VentasDetalleTabla desde={rango.desde} hasta={rango.hasta} sucursal={sucursal} />}
        </section>

        <p className="text-xs text-slate-400 dark:text-ink-500">Datos al {data.ref} · el “hoy” es el último día con ventas registradas.</p>
      </div>
    );
  }

  return (
    <PanelPage title="Panel de ventas" subtitle="Facturación neta de notas de crédito · elegí un rango o tocá una tarjeta; el detalle aparece abajo">
      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300">
        <Hammer size={16} className="shrink-0" />
        <span><b>Sección en construcción.</b> Estamos ajustando los datos y las comparativas; algunos números pueden cambiar.</span>
      </div>
      {body}
    </PanelPage>
  );
}
