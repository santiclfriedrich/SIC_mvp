"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

function fmtDate(at) {
  if (!at) return "";
  const d = new Date(at);
  if (isNaN(d.getTime())) return String(at);
  return d.toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function SyncControl() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const state = status?.sync?.state;

  const load = useCallback(() => {
    fetch("/api/panel/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setStatus(j))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, state === "running" ? 2500 : 90000);
    return () => clearInterval(id);
  }, [load, state]);

  const syncing = state === "running" || busy;

  const onSync = async () => {
    setBusy(true);
    try {
      await fetch("/api/panel/sync", { method: "POST" });
    } catch {}
    setTimeout(load, 1500);
    setBusy(false);
  };

  const lastAt = status?.last_sync?.at;
  const autoLabel = status?.auto_sync_minutes
    ? status.auto_sync_minutes % 60 === 0
      ? `${status.auto_sync_minutes / 60} h`
      : `${status.auto_sync_minutes} min`
    : null;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {lastAt && (
        <span className="hidden text-xs text-white/50 lg:inline">
          Últ. sinc.: {fmtDate(lastAt)}{autoLabel ? ` · auto cada ${autoLabel}` : ""}
        </span>
      )}
      <button
        onClick={onSync}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        title="Disparar la sincronización del ERP"
      >
        <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
        <span className="hidden sm:inline">{syncing ? "Sincronizando…" : "Sincronizar"}</span>
      </button>
    </div>
  );
}
