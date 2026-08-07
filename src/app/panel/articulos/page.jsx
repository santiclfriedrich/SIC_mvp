"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FileDown } from "lucide-react";
import { PanelPage } from "@/components/panel/PanelPage";
import { Card } from "@/components/panel/Card";
import { ValuationControls } from "@/components/panel/ValuationControls";
import { ItemDrawer } from "@/components/panel/ItemDrawer";
import { fmtMoney, fmtMoneyDec, fmtQty } from "@/lib/panel/format";

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100";

function ArticulosInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // valorización (local, como en Resumen) + filtros para los selects
  const [prli, setPrli] = useState(0);
  const [priceLists, setPriceLists] = useState([]);
  const [cotizacion, setCotizacion] = useState(null);
  const [filters, setFilters] = useState(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const q = sp.get("q") ?? "";
  const cat = sp.get("cat") ?? "";
  const brand = sp.get("brand") ?? "";
  const stor = sp.get("stor") ?? "";
  const stock = sp.get("stock") ?? "con";
  const sort = sp.get("sort") ?? "valor";
  const dir = sp.get("dir") ?? "desc";
  const page = Math.max(1, Number(sp.get("page") ?? "1"));

  const [qInput, setQInput] = useState(q);
  useEffect(() => setQInput(q), [q]);

  useEffect(() => {
    fetch("/api/panel/filters")
      .then((r) => r.json())
      .then((j) => {
        setFilters(j);
        setPriceLists(j.price_lists || []);
        setCotizacion(j.cotizacion ?? null);
      })
      .catch(() => {});
  }, []);

  // patch de filtros → URL (resetea a página 1 salvo que se pida otra)
  const patch = (next, keepPage = false) => {
    const merged = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) merged.set(k, v);
      else merged.delete(k);
    }
    if (!keepPage) merged.set("page", "1");
    router.replace(`${pathname}?${merged.toString()}`, { scroll: false });
  };

  // debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput !== q) patch({ q: qInput });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const listParams = useMemo(() => {
    const p = new URLSearchParams({ prli: String(prli ?? ""), stock, sort, dir });
    if (q) p.set("q", q);
    if (cat) p.set("cat", cat);
    if (brand) p.set("brand", brand);
    if (stor) p.set("stor", stor);
    return p;
  }, [prli, stock, sort, dir, q, cat, brand, stor]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetch(`/api/panel/items?${listParams.toString()}&page=${page}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (!cancel) {
          setData(j);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancel) {
          setData(null);
          setLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [listParams, page]);

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

  const esCosto = Number(prli) === 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1;

  const toggleSort = (col) => {
    if (sort === col) patch({ dir: dir === "desc" ? "asc" : "desc" });
    else patch({ sort: col, dir: "desc" });
  };
  const arrow = (col) => (sort === col ? (dir === "desc" ? " ↓" : " ↑") : "");

  const excel = () => {
    window.location.href = `/api/panel/items.xlsx?${listParams.toString()}`;
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

  const thBase = "py-2 px-2 text-center text-xs font-medium select-none";
  const thSort = `${thBase} cursor-pointer text-slate-500 hover:text-slate-800 dark:text-ink-400 dark:hover:text-ink-100`;

  return (
    <PanelPage
      title="Artículos"
      subtitle="Buscá por código o descripción; hacé clic en una fila para ver el detalle por depósito"
      actions={actions}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Buscar código, descripción o código de proveedor…"
          className={`${selectCls} min-w-[16rem] flex-1`}
        />
        <select value={cat} onChange={(e) => patch({ cat: e.target.value })} className={selectCls}>
          <option value="">Todas las categorías</option>
          {filters?.categories?.map((c) => (
            <option key={c.cat_id} value={c.cat_id}>{c.cat_desc}</option>
          ))}
        </select>
        <select value={brand} onChange={(e) => patch({ brand: e.target.value })} className={selectCls}>
          <option value="">Todas las marcas</option>
          {filters?.brands?.map((b) => (
            <option key={b.brand_id} value={b.brand_id}>{b.brand_desc}</option>
          ))}
        </select>
        <select value={stor} onChange={(e) => patch({ stor: e.target.value })} className={selectCls}>
          <option value="">Todos los depósitos</option>
          {filters?.storages?.map((s) => (
            <option key={s.stor_id} value={s.stor_id}>{s.stor_name}</option>
          ))}
        </select>
        <select value={stock} onChange={(e) => patch({ stock: e.target.value })} className={selectCls}>
          <option value="con">Con stock</option>
          <option value="sin">Sin stock</option>
          <option value="neg">Stock negativo ⚠</option>
          <option value="sincosto">Con stock, sin costo ⚠</option>
          <option value="todos">Todos</option>
        </select>
        <button
          onClick={excel}
          title="Descarga el listado con los filtros aplicados"
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
        >
          <FileDown size={15} />
          Excel
        </button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-ink-700">
                <th className={`${thSort} text-left`} onClick={() => toggleSort("codigo")}>Código{arrow("codigo")}</th>
                <th className={`${thSort} text-left`} onClick={() => toggleSort("desc")}>Descripción{arrow("desc")}</th>
                <th className={`${thBase} text-slate-500 dark:text-ink-400`}>Categoría</th>
                <th className={`${thBase} text-slate-500 dark:text-ink-400`}>Marca</th>
                <th className={thSort} onClick={() => toggleSort("stock")}>Físico{arrow("stock")}</th>
                <th className={`${thBase} text-slate-500 dark:text-ink-400`} title="Disponible para la venta (descuenta pedidos ya tomados)">Disp.</th>
                <th className={thSort} onClick={() => toggleSort("precio")}>{esCosto ? "Costo" : "Precio"}{arrow("precio")}</th>
                <th className={thSort} onClick={() => toggleSort("valor")}>{esCosto ? "Valorizado a costo" : "Valorizado"}{arrow("valor")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400 dark:text-ink-500">Cargando…</td></tr>
              ) : !data || !data.rows.length ? (
                <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400 dark:text-ink-500">Sin resultados con esos filtros.</td></tr>
              ) : (
                data.rows.map((r) => (
                  <tr
                    key={r.item_id}
                    onClick={() => setSelected(r.item_id)}
                    className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-ink-800 dark:hover:bg-ink-800/60"
                  >
                    <td className="py-2 px-2 text-left font-mono text-[13px] font-medium tracking-wide text-slate-700 dark:text-ink-200">{r.item_code}</td>
                    <td className="py-2 px-2 text-left text-slate-700 dark:text-ink-200">
                      {r.item_desc}
                      {r.vendor_code && <div className="text-xs text-slate-400 dark:text-ink-500">{r.vendor_code}</div>}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-500 dark:text-ink-400">{r.cat_desc || "—"}</td>
                    <td className="py-2 px-2 text-center text-slate-500 dark:text-ink-400">{r.brand_desc || "—"}</td>
                    <td className={`py-2 px-2 text-center tabular-nums ${
                      Number(r.unidades) < 0
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : Number(r.unidades) === 0
                          ? "text-slate-400 dark:text-ink-500"
                          : "text-slate-700 dark:text-ink-200"
                    }`}>{fmtQty(r.unidades)}</td>
                    <td className="py-2 px-2 text-center tabular-nums text-slate-400 dark:text-ink-500">{fmtQty(r.disponibles)}</td>
                    <td className="py-2 px-2 text-center tabular-nums text-slate-700 dark:text-ink-200">{r.price ? fmtMoneyDec(r.price, r.curr) : "—"}</td>
                    <td className="py-2 px-2 text-center font-semibold tabular-nums text-slate-900 dark:text-ink-100">{r.valor ? fmtMoney(r.valor, r.curr) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <button
              disabled={page <= 1}
              onClick={() => patch({ page: String(page - 1) }, true)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-800"
            >← Anterior</button>
            <span className="text-slate-500 dark:text-ink-400">
              Página {page} de {fmtQty(pages)} · {fmtQty(data.total)} artículos
            </span>
            <button
              disabled={page >= pages}
              onClick={() => patch({ page: String(page + 1) }, true)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-800"
            >Siguiente →</button>
          </div>
        )}
      </Card>

      {selected !== null && (
        <ItemDrawer
          itemId={selected}
          onClose={() => setSelected(null)}
          onFilter={(p) => {
            setSelected(null);
            patch({
              cat: p.cat ? String(p.cat) : "",
              brand: p.brand ? String(p.brand) : "",
              q: "",
              stor: "",
              stock: "con",
            });
          }}
        />
      )}
    </PanelPage>
  );
}

export default function ArticulosPage() {
  return (
    <Suspense fallback={<PanelPage title="Artículos" />}>
      <ArticulosInner />
    </Suspense>
  );
}
