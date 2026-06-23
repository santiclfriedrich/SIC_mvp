"use client";

import { useEffect, useState } from "react";

// Edita las tasas/coeficientes por tienda y las tablas de fee (JSON avanzado).
// Persiste todo el objeto config vía PUT /api/tiendas/config.
export function AjustesClient() {
  const [config, setConfig] = useState(null);
  const [feeText, setFeeText] = useState("");
  const [feeErr, setFeeErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch("/api/tiendas/config")
      .then((r) => r.json())
      .then((j) => {
        setConfig(j.config);
        setFeeText(JSON.stringify(j.config.feeTables, null, 2));
      });
  }, []);

  if (!config) return <div className="text-sm text-[#9B978F] p-6">Cargando…</div>;

  function setStore(key, patch) {
    setConfig((c) => ({
      ...c,
      stores: { ...c.stores, [key]: { ...c.stores[key], ...patch } },
    }));
  }
  function setPago(key, pago, patch) {
    setConfig((c) => {
      const store = c.stores[key];
      return {
        ...c,
        stores: {
          ...c.stores,
          [key]: {
            ...store,
            pagos: { ...store.pagos, [pago]: { ...store.pagos[pago], ...patch } },
          },
        },
      };
    });
  }

  // Los inputs muestran porcentajes (13 = 13%); se guardan como fracción.
  const toPctInput = (frac) => (frac == null ? "" : +(frac * 100).toFixed(4));
  const fromPctInput = (v) => (v === "" ? 0 : Number(v) / 100);

  async function guardar() {
    setFeeErr(null);
    let feeTables;
    try {
      feeTables = JSON.parse(feeText);
    } catch (e) {
      setFeeErr("Las tablas de fee no son JSON válido: " + e.message);
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/tiendas/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { ...config, feeTables } }),
      });
      const j = await res.json();
      if (!res.ok) setErr(j.error || "Error al guardar");
      else {
        setMsg("Guardado.");
        setConfig(j.config);
        setFeeText(JSON.stringify(j.config.feeTables, null, 2));
      }
    } catch (e) {
      setErr("Error de red: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#595959]">
        Cambiá comisiones, comisión CSI y el coeficiente de 3 cuotas por tienda.
        Los porcentajes se ingresan en % (ej. 15 = 15%).
      </p>

      <div className="grid gap-4">
        {Object.values(config.stores).map((s) => (
          <div key={s.key} className="bg-white rounded-xl border border-black/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[#1A1917]">{s.nombre}</h3>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5">
                  Logística %
                  <input
                    type="number"
                    step="0.01"
                    value={toPctInput(s.logistica)}
                    onChange={(e) => setStore(s.key, { logistica: fromPctInput(e.target.value) })}
                    className="px-2 py-1 rounded-md border border-[#E3E1DC] bg-[#FAFAF9] w-16"
                  />
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!s.activo}
                    onChange={(e) => setStore(s.key, { activo: e.target.checked })}
                  />
                  Activa
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-5 items-end">
              {Object.entries(s.pagos).map(([pago, cfg]) => (
                <div key={pago} className="flex gap-3 items-end">
                  <div>
                    <label className="block text-[11px] text-[#625F5A] mb-1">
                      {pago === "1pago" ? "1 pago" : "3 CSI"} · comisión %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={toPctInput(cfg.comision)}
                      onChange={(e) => setPago(s.key, pago, { comision: fromPctInput(e.target.value) })}
                      className="px-2 py-1.5 rounded-lg border border-[#E3E1DC] bg-[#FAFAF9] text-sm w-24"
                    />
                  </div>
                  {pago === "3csi" && (
                    <div>
                      <label className="block text-[11px] text-[#625F5A] mb-1">comisión CSI %</label>
                      <input
                        type="number"
                        step="0.01"
                        value={toPctInput(cfg.csi)}
                        onChange={(e) => setPago(s.key, pago, { csi: fromPctInput(e.target.value) })}
                        className="px-2 py-1.5 rounded-lg border border-[#E3E1DC] bg-[#FAFAF9] text-sm w-24"
                      />
                    </div>
                  )}
                </div>
              ))}

              {s.coefCSI != null && (
                <div>
                  <label className="block text-[11px] text-[#625F5A] mb-1">coef. 3 CSI</label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={s.coefCSI ?? ""}
                    onChange={(e) => setStore(s.key, { coefCSI: Number(e.target.value) })}
                    className="px-2 py-1.5 rounded-lg border border-[#E3E1DC] bg-[#FAFAF9] text-sm w-36"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-black/[0.06] p-5">
        <h3 className="text-base font-semibold text-[#1A1917] mb-2">Tablas de fee por peso</h3>
        <p className="text-xs text-[#9B978F] mb-3">
          Avanzado: JSON de tramos por tienda{" "}
          <code className="text-[#595959]">{"{ desdeKg, hastaKg, feeConIVA, feeConIVA30mil? }"}</code>.
        </p>
        <textarea
          value={feeText}
          onChange={(e) => setFeeText(e.target.value)}
          spellCheck={false}
          className="w-full h-72 font-mono text-xs px-3 py-2 rounded-lg border border-[#E3E1DC] bg-[#FAFAF9] outline-none focus:border-[#14B8A6]"
        />
        {feeErr && <p className="text-xs text-red-600 mt-2">{feeErr}</p>}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={busy}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-br from-[#0F766E] to-[#14B8A6] text-white text-sm font-semibold hover:shadow-lg disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar ajustes"}
        </button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}
