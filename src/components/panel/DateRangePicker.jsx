"use client";
import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => new Date(`${s}T00:00:00`);
const lindo = (s) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const startWd = (first.getDay() + 6) % 7; // lunes = 0
  const start = new Date(year, month, 1 - startWd);
  const cells = [];
  const cur = new Date(start);
  for (let i = 0; i < 42; i++) { cells.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return cells;
}

function MonthGrid({ year, month, from, to, hover, onPick, onHover }) {
  const end = to || hover;
  const inRange = (d) => {
    if (!from || !end) return false;
    const a = startOfDay(from <= end ? from : end);
    const b = startOfDay(from <= end ? end : from);
    const x = startOfDay(d);
    return x >= a && x <= b;
  };
  return (
    <div className="select-none">
      <div className="mb-2 text-center text-sm font-semibold capitalize text-slate-800 dark:text-ink-100">{MESES[month]} {year}</div>
      <div className="grid grid-cols-7 text-center text-[11px] text-slate-400 dark:text-ink-500">
        {DIAS.map((d) => (<div key={d} className="py-1">{d}</div>))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {monthCells(year, month).map((d, i) => {
          const other = d.getMonth() !== month;
          const sel = sameDay(d, from) || sameDay(d, to);
          const rng = inRange(d);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(d)}
              onMouseEnter={() => onHover(d)}
              className={[
                "h-8 w-8 rounded-md text-sm tabular-nums transition-colors",
                other ? "text-slate-300 dark:text-ink-600" : "text-slate-700 dark:text-ink-200",
                sel
                  ? "bg-brand-600 font-semibold text-white dark:bg-brand-600 dark:text-white"
                  : rng
                    ? "bg-brand-50 text-brand-700 dark:bg-ink-800 dark:text-brand-300"
                    : "hover:bg-slate-100 dark:hover:bg-ink-800",
              ].join(" ")}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Selector de rango de fechas: presets + calendario de 2 meses en un popover,
 *  con Cancelar/Aplicar. `anchor` (yyyy-MM-dd) es el "hoy" del panel (último
 *  día con ventas), para que los presets se calculen sobre datos reales. */
export function DateRangePicker({ value, onChange, anchor }) {
  const hoy = anchor ? fromISO(anchor) : new Date();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value ? fromISO(value.desde) : null);
  const [to, setTo] = useState(value ? fromISO(value.hasta) : null);
  const [hover, setHover] = useState(null);
  const [view, setView] = useState(value ? fromISO(value.desde) : hoy);
  const ref = useRef(null);

  useEffect(() => {
    if (open) {
      setFrom(value ? fromISO(value.desde) : null);
      setTo(value ? fromISO(value.hasta) : null);
      setHover(null);
      setView(value ? fromISO(value.desde) : hoy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (d) => {
    if (!from || (from && to)) { setFrom(d); setTo(null); }
    else if (d < from) { setTo(from); setFrom(d); }
    else setTo(d);
  };

  const presets = [
    { label: "Hoy", from: hoy, to: hoy },
    { label: "Últimos 7 días", from: addDays(hoy, -6), to: hoy },
    { label: "Este mes", from: new Date(hoy.getFullYear(), hoy.getMonth(), 1), to: hoy },
    { label: "Este año", from: new Date(hoy.getFullYear(), 0, 1), to: hoy },
    { label: "Año anterior", from: new Date(hoy.getFullYear() - 1, 0, 1), to: new Date(hoy.getFullYear() - 1, 11, 31) },
    { label: "Todo", from: new Date(2020, 0, 1), to: hoy },
  ];
  const applyPreset = (p) => { onChange({ desde: iso(p.from), hasta: iso(p.to) }); setOpen(false); };
  const aplicar = () => { if (!from) return; onChange({ desde: iso(from), hasta: iso(to || from) }); setOpen(false); };

  const label = value
    ? value.desde === value.hasta ? lindo(value.desde) : `${lindo(value.desde)} — ${lindo(value.hasta)}`
    : "Elegí un rango";

  const next = addMonths(view, 1);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700">
        <CalendarIcon size={15} className="text-slate-400" />
        <span className="tabular-nums">{label}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-auto max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-900">
          <div className="flex flex-col md:flex-row">
            <div className="flex flex-row flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-ink-700 md:min-w-[150px] md:flex-col md:border-b-0 md:border-r">
              {presets.map((p) => (
                <button key={p.label} type="button" onClick={() => applyPreset(p)} className="rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-100">
                  {p.label}
                </button>
              ))}
            </div>
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <button type="button" onClick={() => setView(addMonths(view, -1))} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800" aria-label="Mes anterior"><ChevronLeft size={16} /></button>
                <button type="button" onClick={() => setView(addMonths(view, 1))} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800" aria-label="Mes siguiente"><ChevronRight size={16} /></button>
              </div>
              <div className="flex gap-6" onMouseLeave={() => setHover(null)}>
                <MonthGrid year={view.getFullYear()} month={view.getMonth()} from={from} to={to} hover={hover} onPick={pick} onHover={setHover} />
                <div className="hidden md:block">
                  <MonthGrid year={next.getFullYear()} month={next.getMonth()} from={from} to={to} hover={hover} onPick={pick} onHover={setHover} />
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800">Cancelar</button>
                <button type="button" onClick={aplicar} disabled={!from} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-600">Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
