"use client";

import { useEffect, useMemo, useState } from "react";
import { forwardStore, inverseStore, rentaRandom } from "@/lib/pricing/engine";

function formatARS(n) {
  if (n == null || n === "") return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}
function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return (n * 100).toFixed(2) + "%";
}
function rentaColor(n) {
  if (n == null || !Number.isFinite(n)) return "text-[#9B978F]";
  if (n < 0.02) return "text-red-600";
  if (n < 0.04) return "text-amber-600";
  return "text-emerald-600";
}

// Parseo defensivo: si la respuesta no es ok o el body viene vacío/no-JSON,
// no rompe la página; devuelve { ok, data, error }.
async function safeFetch(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, data, error: !res.ok ? data.error || `HTTP ${res.status}` : null };
}

export function PreciosClient() {
  const [config, setConfig] = useState(null);
  const [productos, setProductos] = useState([]);
  const [drafts, setDrafts] = useState([]); // SKUs agregados, aún sin precio guardado
  const [upload, setUpload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [syncWarn, setSyncWarn] = useState(null);

  // Muestra (o limpia) un aviso si la sincronización con la planilla viva falló.
  function revisarSync(j) {
    const s = j?.sync;
    if (s && !s.ok && s.motivo && s.motivo !== "sin planilla viva") {
      setSyncWarn(`No se pudo escribir en la planilla viva: ${s.motivo}`);
    } else {
      setSyncWarn(null);
    }
  }

  async function cargarTodo() {
    setLoading(true);
    setLoadError(null);
    try {
      const [c, p, u] = await Promise.all([
        safeFetch("/api/tiendas/config"),
        safeFetch("/api/tiendas/productos"),
        safeFetch("/api/tiendas/report21"),
      ]);
      if (c.data.config) setConfig(c.data.config);
      setProductos(p.data.productos || []);
      setUpload(u.data.upload || null);
      const err = c.error || p.error || u.error;
      if (err) setLoadError(err);
    } catch (e) {
      setLoadError("Error de red: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  const stores = useMemo(
    () => (config ? Object.values(config.stores).filter((s) => s.activo) : []),
    [config]
  );

  // Guarda el precio de un SKU+tienda+modalidad y refresca.
  async function savePrecio(sku, store, precio, pago = "1pago") {
    const res = await fetch("/api/tiendas/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, store, pago, precio: precio === "" ? null : Number(precio) }),
    });
    const j = await res.json();
    if (!res.ok) {
      alert(j.error || "Error al guardar");
      return;
    }
    revisarSync(j);
    // Saca el draft (ya está persistido) y mergea el producto devuelto.
    setDrafts((d) => d.filter((x) => x.sku !== sku));
    setProductos((prev) => {
      const otros = prev.filter((x) => x.sku !== sku);
      return [j.producto, ...otros];
    });
  }

  // Cambia el flag LP de un SKU (afecta ingresos brutos / IIB LP → toda la fila).
  async function saveLP(sku, esLP) {
    const res = await fetch("/api/tiendas/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, esLP }),
    });
    const j = await res.json();
    if (!res.ok) {
      alert(j.error || "Error al cambiar LP");
      return;
    }
    revisarSync(j);
    setDrafts((d) => d.filter((x) => x.sku !== sku));
    setProductos((prev) => {
      const otros = prev.filter((x) => x.sku !== sku);
      return [j.producto, ...otros];
    });
  }

  async function borrar(sku) {
    // Si es sólo un draft (nunca persistido), se quita local sin llamar al server.
    const esDraft = drafts.some((x) => x.sku === sku) && !productos.some((x) => x.sku === sku);
    setDrafts((d) => d.filter((x) => x.sku !== sku));
    if (esDraft) return;

    const { ok, data } = await safeFetch(`/api/tiendas/productos/${encodeURIComponent(sku)}`, {
      method: "DELETE",
    });
    if (!ok) {
      setSyncWarn(`No se pudo borrar "${sku}": ${data.error || "error"}.`);
      return; // no lo saco de la lista si el borrado falló
    }
    revisarSync(data);
    setProductos((prev) => prev.filter((x) => x.sku !== sku));
  }

  // Filas a mostrar: drafts que todavía no están en productos, + productos.
  const filas = useMemo(() => {
    const enProductos = new Set(productos.map((p) => p.sku));
    return [...drafts.filter((d) => !enProductos.has(d.sku)), ...productos];
  }, [drafts, productos]);

  if (loading && !config) {
    return <div className="text-sm text-[#9B978F] p-6">Cargando…</div>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          No se pudieron cargar todos los datos: {loadError}
          <button onClick={cargarTodo} className="ml-3 underline font-medium">
            Reintentar
          </button>
        </div>
      )}

      {syncWarn && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm flex items-start justify-between gap-3">
          <span>⚠️ {syncWarn} (tu cambio sí se guardó en la web).</span>
          <button onClick={() => setSyncWarn(null)} className="text-amber-600 hover:text-amber-800 font-medium">✕</button>
        </div>
      )}

      <Report21Card upload={upload} onUploaded={cargarTodo} />

      <PlanillaVivaCard onSynced={cargarTodo} />

      {config && <AddSkuBar onDone={cargarTodo} />}

      <ExportsBar productos={productos} />

      {config && (
        <PreciosTable
          filas={filas}
          stores={stores}
          config={config}
          onSave={savePrecio}
          onToggleLP={saveLP}
          onDelete={borrar}
        />
      )}
    </div>
  );
}

/* ----------------------------- report21 / planilla ----------------------------- */
function Report21Card({ upload, onUploaded }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  async function subir(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/tiendas/report21", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) setErr(j.error || "Error al procesar");
      else {
        const partes = [];
        if (j.filasReport21) partes.push(`${j.filasReport21} SKUs en catálogo (report21)`);
        if (j.report21EnSheet) partes.push(`pestaña report21 del Sheet actualizada (${j.report21EnSheet.filas} filas)`);
        if (j.preciosImportados)
          partes.push(
            `${j.preciosImportados} con precio (${j.creados} nuevos, ${j.actualizados} actualizados)`
          );
        setMsg("OK: " + (partes.join(" · ") || "archivo procesado"));
        setFile(null);
        onUploaded();
      }
    } catch (e2) {
      setErr("Error de red: " + e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={subir} className="bg-white rounded-xl border border-black/[0.06] p-6">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <label className="block text-sm font-medium text-[#1A1917]">
          Subir planilla (.xls / .xlsx) — lee la hoja <code>report21</code> y los
          precios de <code>AJUSTE formula cobramos-ganamo</code>
        </label>
        {upload && (
          <span className="text-xs text-[#9B978F]">
            Último: <strong className="text-[#595959]">{upload.fuente}</strong> ·{" "}
            {upload.filas} SKUs ·{" "}
            {new Date(upload.createdAt).toLocaleString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={busy}
          className="text-sm text-[#1A1917] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#E5E7EB] file:text-[#1A1917] hover:file:bg-[#D1D5DB] file:cursor-pointer"
        />
        <button
          type="submit"
          disabled={!file || busy}
          className="px-5 py-2 rounded-lg bg-gradient-to-br from-[#0F766E] to-[#14B8A6] text-white text-sm font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {busy ? "Procesando…" : "Subir planilla"}
        </button>
      </div>
      {msg && <p className="text-xs text-emerald-700 mt-2">{msg}</p>}
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </form>
  );
}

/* ----------------------------- planilla viva ----------------------------- */
function PlanillaVivaCard({ onSynced }) {
  const [estado, setEstado] = useState(null); // { existe, url, skus, tieneMolde }
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  async function cargar() {
    try {
      const r = await fetch("/api/tiendas/planilla-viva");
      setEstado(await r.json());
    } catch {
      /* ignore */
    }
  }
  useEffect(() => { cargar(); }, []);

  async function crear() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/tiendas/planilla-viva", { method: "POST" });
      const j = await r.json();
      if (!r.ok) setErr(j.error || "Error al crear la planilla viva");
      else { await cargar(); }
    } catch (e) {
      setErr("Error de red: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sincronizar() {
    setSyncing(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/tiendas/planilla-viva/sync", { method: "POST" });
      const j = await r.json();
      if (!r.ok) setErr(j.error || "Error al sincronizar");
      else {
        setMsg(j.actualizados > 0 ? `${j.actualizados} SKU(s) actualizados desde la planilla.` : "La web ya estaba al día.");
        onSynced?.();
      }
    } catch (e) {
      setErr("Error de red: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  if (!estado) return null;

  return (
    <div className="bg-white rounded-xl border border-black/[0.06] p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${estado.existe ? "bg-emerald-500" : "bg-[#CBD5E1]"}`} />
          <span className="text-sm font-medium text-[#1A1917]">Planilla viva</span>
        </div>

        {estado.existe ? (
          <>
            <span className="text-xs text-[#9B978F]">
              Activa · {estado.skus} SKUs. Tus cambios de precio / LP se escriben acá al instante.
            </span>
            <a href={estado.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0F766E] hover:underline font-medium">
              Abrir planilla viva →
            </a>
            <button
              onClick={sincronizar}
              disabled={syncing}
              className="px-3 py-1.5 rounded-lg border border-[#0F766E] text-[#0F766E] text-xs font-medium hover:bg-[#0F766E]/5 disabled:opacity-50"
              title="Trae a la web los precios que editaste directamente en el Sheet"
            >
              {syncing ? "Sincronizando…" : "↓ Traer cambios del Sheet"}
            </button>
            <button
              onClick={crear}
              disabled={busy}
              className="text-xs text-[#9B978F] hover:text-[#595959] underline disabled:opacity-50"
              title="Crea una copia fresca desde el molde (la actual se manda a la papelera)"
            >
              {busy ? "Recreando…" : "Recrear"}
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-[#9B978F]">
              {estado.tieneMolde
                ? "Creá la planilla viva: una copia de tu planilla que se mantiene sincronizada con la web."
                : "Subí la planilla primero (se usa como molde)."}
            </span>
            <button
              onClick={crear}
              disabled={busy || !estado.tieneMolde}
              className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-sm font-medium hover:bg-[#0d655e] disabled:opacity-50"
            >
              {busy ? "Creando…" : "Crear planilla viva"}
            </button>
          </>
        )}
      </div>
      {msg && <p className="text-xs text-emerald-700 mt-2">{msg}</p>}
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </div>
  );
}

/* ----------------------------- agregar SKU(s) con auto-precio ----------------------------- */
function AddSkuBar({ onDone }) {
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [res, setRes] = useState(null); // { creados, actualizados, noEncontrados }

  const skus = texto.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

  async function agregar(e) {
    e.preventDefault();
    if (!skus.length) return;
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      const { ok, data } = await safeFetch("/api/tiendas/productos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skus }),
      });
      if (!ok) {
        setErr(data.error || "Error al procesar");
      } else {
        setRes(data);
        setTexto("");
        onDone?.();
      }
    } catch (e2) {
      setErr("Error de red: " + e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={agregar} className="bg-white rounded-xl border border-black/[0.06] p-4">
      <label className="block text-xs font-medium text-[#625F5A] mb-1">
        Agregar SKU(s) con precio automático 4–5%
      </label>
      <div className="flex items-start gap-3 flex-wrap">
        <textarea
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setErr(null); setRes(null); }}
          placeholder="Pegá uno o varios SKUs (uno por línea, o separados por coma/espacio). Ej:&#10;MONKAN0034&#10;MICKAN0002&#10;VENKAN0004"
          rows={3}
          className="flex-1 min-w-[260px] px-3 py-2 rounded-lg border border-[#E3E1DC] bg-[#FAFAF9] text-sm outline-none focus:border-[#14B8A6] font-mono"
        />
        <div className="flex flex-col gap-1">
          <button
            type="submit"
            disabled={busy || !skus.length}
            className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-sm font-medium hover:bg-[#0d655e] disabled:opacity-50 whitespace-nowrap"
          >
            {busy ? "Procesando…" : `Agregar ${skus.length || ""} y autopreciar`}
          </button>
          <span className="text-[11px] text-[#9B978F] max-w-[180px]">
            Trae los datos del report21 y pone precio en todas las tiendas con renta 4–5%.
          </span>
        </div>
      </div>
      {res && (
        <p className="text-xs text-emerald-700 mt-2">
          OK: {res.creados} nuevos, {res.actualizados} actualizados
          {res.noEncontrados?.length
            ? ` · ${res.noEncontrados.length} no estaban en el report21: ${res.noEncontrados.slice(0, 8).join(", ")}${res.noEncontrados.length > 8 ? "…" : ""}`
            : ""}
          .
        </p>
      )}
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </form>
  );
}

/* ----------------------------- exports ----------------------------- */
function ExportsBar({ productos }) {
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheet, setSheet] = useState(null); // { url, escritos, sinFila }
  const [err, setErr] = useState(null);
  const vacio = productos.length === 0;

  async function aSheets() {
    setSheetBusy(true);
    setErr(null);
    setSheet(null);
    try {
      const res = await fetch("/api/tiendas/sheets", { method: "POST" });
      const j = await res.json();
      if (!res.ok) setErr(j.error || "Error al generar el Sheet");
      else setSheet({ url: j.embedUrl, escritos: j.escritos, sinFila: j.sinFila });
    } catch (e) {
      setErr("Error de red: " + e.message);
    } finally {
      setSheetBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-black/[0.06] p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-[#1A1917]">Exportar:</span>
        <a
          href="/api/tiendas/export?mode=pegar"
          className={`px-4 py-2 rounded-lg border border-[#E3E1DC] text-sm font-medium text-[#1A1917] hover:bg-[#F8F9FA] ${vacio ? "pointer-events-none opacity-50" : ""}`}
        >
          Excel &quot;para pegar&quot;
        </a>
        <a
          href="/api/tiendas/export?mode=full"
          className={`px-4 py-2 rounded-lg border border-[#E3E1DC] text-sm font-medium text-[#1A1917] hover:bg-[#F8F9FA] ${vacio ? "pointer-events-none opacity-50" : ""}`}
        >
          Excel desglose
        </a>
        <button
          onClick={aSheets}
          disabled={sheetBusy || vacio}
          className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-sm font-medium hover:bg-[#0d655e] disabled:opacity-50"
          title="Copia tu planilla original con los precios de la web"
        >
          {sheetBusy ? "Generando copia de la planilla…" : "A Google Sheets (planilla original)"}
        </button>
        {sheet && (
          <a href={sheet.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0F766E] hover:underline font-medium">
            Abrir Sheet →
          </a>
        )}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
      {sheet && (
        <p className="text-xs text-emerald-700 mt-2">
          Copia generada: {sheet.escritos} precios escritos en la planilla
          {sheet.sinFila ? ` · ${sheet.sinFila} SKU(s) de la web no estaban en la planilla original (no escritos)` : ""}.
        </p>
      )}
    </div>
  );
}

/* ----------------------------- celda editable ----------------------------- */
// Valor "efectivo" de una celda: para 3csi, el override si existe, si no el
// derivado (1 pago × coef).
function valorEfectivo(producto, storeCfg, pago) {
  const key = storeCfg.key;
  if (pago === "1pago") {
    const v = producto.precios?.[key];
    return { value: v != null ? Number(v) : null, derivado: false };
  }
  const override = producto.precios3?.[key];
  if (override != null) return { value: Number(override), derivado: false };
  const p1 = producto.precios?.[key];
  if (p1 != null && storeCfg.coefCSI) {
    return { value: Number(p1) * storeCfg.coefCSI, derivado: true };
  }
  return { value: null, derivado: false };
}

function PriceCell({ producto, storeCfg, pago, config, onSave }) {
  const eff = valorEfectivo(producto, storeCfg, pago);
  const inicial = eff.value != null ? String(Math.round(eff.value)) : "";
  const [val, setVal] = useState(inicial);
  const [saving, setSaving] = useState(false);

  // Re-sincroniza si cambió el valor efectivo desde afuera (ej. editar 1 pago
  // re-deriva el 3CSI).
  useEffect(() => {
    setVal(eff.value != null ? String(Math.round(eff.value)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eff.value]);

  const precioNum = Number(val);
  const renta = useMemo(() => {
    if (!(precioNum > 0)) return null;
    return forwardStore(storeCfg, pago, producto, precioNum, config).rentaPct;
  }, [precioNum, storeCfg, pago, producto, config]);

  async function commit() {
    const limpio = val === "" ? "" : String(Number(val));
    const actual = eff.value != null ? String(Math.round(eff.value)) : "";
    if (limpio === actual) return; // sin cambios reales
    setSaving(true);
    await onSave(producto.sku, storeCfg.key, val === "" ? "" : precioNum, pago);
    setSaving(false);
  }

  function auto() {
    const objetivo = rentaRandom(0.04, 0.05, Math.random());
    const p = Math.round(inverseStore(storeCfg, pago, producto, objetivo, config));
    setVal(String(p));
    setSaving(true);
    onSave(producto.sku, storeCfg.key, p, pago).finally(() => setSaving(false));
  }

  return (
    <td className="px-2 py-1.5 align-top">
      <div className="flex flex-col items-end gap-0.5 min-w-[112px]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={auto}
            title="Precio automático 4–5%"
            className="text-[11px] text-[#0F766E] hover:text-[#0d655e] px-0.5"
          >
            ⚡
          </button>
          <input
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            placeholder="—"
            disabled={saving}
            title={eff.derivado ? "Derivado del 1 pago (editalo para fijarlo independiente)" : undefined}
            className={`w-24 text-right px-2 py-1 rounded-md border text-sm outline-none focus:border-[#14B8A6] disabled:opacity-50 ${eff.derivado ? "border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] italic" : "border-[#E3E1DC] bg-white"}`}
          />
        </div>
        {renta != null ? (
          <div className="text-[11px] text-right">
            <span className={`font-semibold ${rentaColor(renta)}`}>{formatPct(renta)}</span>
            {pago === "3csi" && eff.derivado && <span className="text-[#9B978F]"> · deriv.</span>}
          </div>
        ) : (
          <div className="text-[11px] text-[#C8C5BE]">—</div>
        )}
      </div>
    </td>
  );
}

/* ----------------------------- tabla ----------------------------- */
function PreciosTable({ filas, stores, config, onSave, onToggleLP, onDelete }) {
  // Columnas: por tienda, "1 pago" y (si tiene) "3 CSI".
  const cols = [];
  for (const s of stores) {
    cols.push({ key: `${s.key}-1pago`, storeKey: s.key, pago: "1pago", label: `${s.nombre} · 1 pago` });
    if (s.pagos["3csi"] && s.coefCSI) {
      cols.push({ key: `${s.key}-3csi`, storeKey: s.key, pago: "3csi", label: `${s.nombre} · 3 CSI` });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
      <div className="px-5 py-3 bg-gradient-to-r from-[#0F766E] to-[#14B8A6] text-white flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold">Precios actuales</h3>
        <span className="text-xs text-white/70">({filas.length})</span>
        <span className="text-xs text-white/60 ml-2">
          — editá el precio en la celda; se guarda al salir. El 3 CSI se deriva del 1 pago (borde punteado) hasta que lo edites.
        </span>
      </div>

      {filas.length === 0 ? (
        <div className="p-6 text-sm text-[#9B978F]">
          Todavía no hay precios. Subí la planilla o agregá un SKU arriba.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA] text-[#595959]">
              <tr>
                <th className="text-left px-3 py-2 font-medium sticky left-0 bg-[#F8F9FA]">SKU</th>
                {cols.map((c) => (
                  <th key={c.key} className="text-right px-3 py-2 font-medium whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((p, i) => (
                <tr key={p.sku} className={i % 2 ? "bg-[#F8F9FA]" : "bg-white"}>
                  <td className={`px-3 py-2 font-medium text-[#1A1917] whitespace-nowrap align-top sticky left-0 ${i % 2 ? "bg-[#F8F9FA]" : "bg-white"}`}>
                    <div className="flex items-center gap-1.5">
                      {p.sku}
                      <button
                        onClick={() => onToggleLP(p.sku, !p.esLP)}
                        title={p.esLP ? "Es LP (clic para sacar)" : "No es LP (clic para marcar)"}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.esLP ? "bg-[#0F766E] text-white" : "bg-[#E5E7EB] text-[#9B978F]"}`}
                      >
                        LP
                      </button>
                      {p._draft && <span className="text-[10px] text-amber-600 font-bold">nuevo</span>}
                    </div>
                    <div className="text-[10px] text-[#9B978F] max-w-[180px] truncate font-normal" title={p.descripcion}>
                      {p.descripcion}
                    </div>
                  </td>
                  {cols.map((c) => (
                    <PriceCell
                      key={c.key}
                      producto={p}
                      storeCfg={config.stores[c.storeKey]}
                      pago={c.pago}
                      config={config}
                      onSave={onSave}
                    />
                  ))}
                  <td className="px-3 py-2 text-right align-top">
                    <button
                      onClick={() => onDelete(p.sku)}
                      className="text-[#EF4444] hover:text-[#DC2626]"
                      title="Quitar de la lista"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
