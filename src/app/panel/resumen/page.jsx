"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PanelPage } from "@/components/panel/PanelPage";
import { Card } from "@/components/panel/Card";
import { StatTile } from "@/components/panel/StatTile";
import { HBars } from "@/components/panel/HBars";
import { compact, fmtDec, fmtMoney, fmtQty } from "@/lib/panel/format";

function EmptyNoData() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-ink-700 dark:bg-ink-900/40">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-ink-100">Todavía no hay datos sincronizados</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-ink-300">
        La base se alimenta desde el sync del ERP. La primera sincronización tarda unos minutos.
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-ink-900" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-56 rounded-2xl bg-slate-100 dark:bg-ink-900" />
        ))}
      </div>
    </div>
  );
}

export default function ResumenPage() {
  const router = useRouter();
  const [prli, setPrli] = useState(0);
  const [priceLists, setPriceLists] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/panel/filters")
      .then((r) => r.json())
      .then((j) => setPriceLists(j.price_lists || []))
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

  const esCosto = Number(prli) === 0;

  const actions = (
    <select
      value={prli}
      onChange={(e) => setPrli(Number(e.target.value))}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:hover:border-ink-600"
    >
      {priceLists.length === 0 && <option value={0}>Costo — 01-Lista de Costos</option>}
      {priceLists.map((pl) => (
        <option key={pl.prli_id} value={pl.prli_id}>
          {pl.prli_desc}
        </option>
      ))}
    </select>
  );

  let body;
  if (loading) {
    body = <Skeleton />;
  } else if (error || !data || !data.kpi || !data.kpi.skus_total) {
    body = <EmptyNoData />;
  } else {
    const byCurr = data.value_by_currency || [];
    const cot = Number(data.cotizacion) || 0;
    const totUSD = byCurr.filter((v) => v.curr === "USD").reduce((a, v) => a + (Number(v.valor) || 0), 0);
    const totARS = byCurr.filter((v) => v.curr === "ARS").reduce((a, v) => a + (Number(v.valor) || 0), 0);

    let equiv = null;
    if (cot && totUSD && !totARS) {
      equiv = { label: "Equivalente en pesos (ARS)", value: fmtMoney(totUSD * cot, "ARS"), hint: `al dólar de ${fmtDec(cot)}` };
    } else if (cot && totARS && !totUSD) {
      equiv = { label: "Equivalente en dólares (USD)", value: fmtMoney(totARS / cot, "USD"), hint: `al dólar de ${fmtDec(cot)}` };
    } else if (cot && totARS && totUSD) {
      equiv = { label: "Total en pesos (ARS)", value: fmtMoney(totARS + totUSD * cot, "ARS"), hint: `ARS + USD al dólar de ${fmtDec(cot)}` };
    }

    body = (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-nowrap">
          {byCurr.map((v) => (
            <StatTile
              key={v.curr}
              className="min-w-0 flex-1"
              label={`Stock ${esCosto ? "a costo" : "valorizado"} (${v.curr || "?"})`}
              value={fmtMoney(v.valor, v.curr)}
              hint={`${fmtQty(v.articulos)} artículos con ${esCosto ? "costo" : "precio"}`}
            />
          ))}
          {equiv && <StatTile className="min-w-0 flex-1" label={equiv.label} value={equiv.value} hint={equiv.hint} />}
          <StatTile className="min-w-0 flex-1" label="Unidades en stock" value={fmtQty(data.kpi.unidades)} hint="stock físico total" />
          <StatTile
            className="min-w-0 flex-1"
            label="Artículos con stock"
            value={fmtQty(data.kpi.skus_con_stock)}
            hint={`de ${fmtQty(data.kpi.skus_total)} activos`}
          />
          <StatTile tone="warn" className="min-w-0 flex-1" label="Artículos sin stock" value={fmtQty(data.kpi.skus_sin_stock)} hint="activos con stock 0" />
        </div>

        {data.sin_precio > 0 && (
          <button
            onClick={() => router.push("/panel/articulos?stock=sincosto")}
            className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700 transition-colors hover:bg-orange-100 dark:bg-orange-950/60 dark:text-orange-400 dark:hover:bg-orange-950"
          >
            <AlertTriangle size={15} />
            {fmtQty(data.sin_precio)} artículos con stock sin {esCosto ? "costo" : "precio en esta lista"} — ver listado
          </button>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Valor por categoría" subtitle="Top 12 · valorizado con la lista seleccionada">
            <HBars rows={data.by_category} />
          </Card>
          <Card title="Valor por depósito" subtitle="Dónde está la mercadería">
            <HBars rows={data.by_storage} fmt={(v, r) => `${compact(v)} · ${fmtQty(r.unidades)} u.`} />
          </Card>
          <Card title="Valor por marca" subtitle="Top 10">
            <HBars rows={data.by_brand} />
          </Card>
          <Card title="Top 10 artículos por valor" subtitle="Los que más plata inmovilizan">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-ink-700 dark:text-ink-400">
                    <th className="py-2 text-left font-medium">Código</th>
                    <th className="py-2 text-left font-medium">Descripción</th>
                    <th className="py-2 text-center font-medium">Stock</th>
                    <th className="py-2 text-center font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.top_items || []).map((r, i) => (
                    <tr key={`${r.item_code}-${i}`} className="border-b border-slate-100 last:border-0 dark:border-ink-800">
                      <td className="py-2 text-left font-mono text-[13px] font-medium tracking-wide text-slate-700 dark:text-ink-200">{r.item_code}</td>
                      <td className="py-2 text-left text-slate-600 dark:text-ink-300">{r.item_desc}</td>
                      <td className="py-2 text-center tabular-nums text-slate-700 dark:text-ink-200">{fmtQty(r.unidades)}</td>
                      <td className="py-2 text-center font-medium tabular-nums text-slate-900 dark:text-ink-100">{fmtMoney(r.valor, r.curr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <PanelPage title="Resumen" subtitle="Stock actual y valorización de la mercadería" actions={actions}>
      {body}
    </PanelPage>
  );
}
