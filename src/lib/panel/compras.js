"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export const fmt = new Intl.NumberFormat("es-AR");

/** Trae el análisis de compras cacheado (meta 'compras'). Mientras corre un
 *  recálculo consulta cada 3 s; si no, cada 120 s. */
export function useCompras() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/panel/compras");
      const j = await r.json();
      setData(j?.analysis ?? null);
      setStatus(j?.status ?? null);
      return j?.status?.state;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const schedule = async () => {
      const state = await load();
      if (!alive) return;
      timer.current = setTimeout(schedule, state === "running" ? 3000 : 120000);
    };
    schedule();
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); };
  }, [load]);

  const refresh = useCallback(async () => {
    try { await fetch("/api/panel/compras/refresh", { method: "POST" }); } catch {}
    load();
  }, [load]);

  return { data, status, loading, refresh };
}
