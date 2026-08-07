"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelPage } from "@/components/panel/PanelPage";
import { Card } from "@/components/panel/Card";
import { HBars } from "@/components/panel/HBars";
import { ValuationControls } from "@/components/panel/ValuationControls";
import { compact, fmtQty } from "@/lib/panel/format";

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-56 rounded-2xl bg-slate-100 dark:bg-ink-900" />
      <div className="h-72 rounded-2xl bg-slate-100 dark:bg-ink-900" />
    </div>
  );
}

function EmptyNoData() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-ink-700 dark:bg-ink-900/40">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-ink-100">Todavía no hay datos sincronizados</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-ink-300">
        Tocá <b>“Sincronizar”</b> arriba a la derecha.
      </p>
    </div>
  );
}

const th = "py-2 px-3 text-center text-xs font-medium text-slate-500 dark:text-ink-400";
const td = "py-2 px-3 text-center tabular-nums";

export default function DepositosPage() {
  const router = useRouter();
  const [prli, setPrli] = useState(0);
  const [priceLists, setPriceLists] = useState([]);
  const [cotizacion, setCotizacion] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/panel/filters")
      .then((r) => r.json())
      .then((j) => {
        setPriceLists(j.price_lists || []);
        setCotizacion(j.cotizacion ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(false);
    fetch(`/api/panel/summary?prli=${prli}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (!cancel) {
          setData(j);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancel) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [prli]);

  const onCotizacion = async (n) => {
    try {
      await fetch("/api/panel/cotizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: n }),
      });
      setCotizacion(n);
    } catch {}
  };

  const actions = (
    <ValuationControls
      prli={prli}
      onPrli={setPrli}
      priceLists={priceLists}
      cotizacion={cotizacion}
      onCotizacion={onCotizacion}
    />
  );

  let body;
  if (loading) {
    body = <Skeleton />;
  } else if (error || !data || !data.by_storage?.length) {
    body = <EmptyNoData />;
  } else {
    body = (
      <div className="space-y-5">
        <Card title="Valor por depósito" subtitle="Valorizado con la lista seleccionada">
          <HBars rows={data.by_storage} />
        </Card>
        <Card title="Detalle" subtitle="Hacé clic en un depósito para ver sus artículos">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-ink-700">
                  <th className={`${th} text-left`}>Depósito</th>
                  <th className={th}>Artículos distintos</th>
                  <th className={th}>Unidades (físico)</th>
                  <th className={th} title="Disponible para la venta (descuenta pedidos ya tomados)">Disponibles</th>
                  <th className={th}>Valorizado</th>
                </tr>
              </thead>
              <tbody>
                {data.by_storage.map((s) => (
                  <tr
                    key={s.stor_id}
                    onClick={() => router.push(`/panel/articulos?stor=${s.stor_id}`)}
                    className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-ink-800 dark:hover:bg-ink-800/60"
                  >
                    <td className="px-3 py-2 text-left text-slate-700 dark:text-ink-200">{s.label}</td>
                    <td className={`${td} text-slate-700 dark:text-ink-200`}>{fmtQty(s.skus)}</td>
                    <td className={`${td} text-slate-700 dark:text-ink-200`}>{fmtQty(s.unidades)}</td>
                    <td className={`${td} text-slate-700 dark:text-ink-200`}>{fmtQty(s.disponibles)}</td>
                    <td className={`${td} font-semibold text-slate-900 dark:text-ink-100`}>{compact(s.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <PanelPage title="Depósitos" subtitle="Unidades, artículos distintos y valor por depósito" actions={actions}>
      {body}
    </PanelPage>
  );
}
