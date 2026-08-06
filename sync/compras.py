# -*- coding: utf-8 -*-
"""Análisis de negativos para el área de Compras.

Replica el Apps Script "Auditar Negativos v1.8.3" (portado de
interarea/compras/backend/app/negativos/logic.py). Trae los disponibles por
depósito del GBPScript BI.Negativos (calcula con fnGetAStock, igual que las
pantallas del ERP, e incluye los negativos de comprometido puro que la
operación estándar pierde) y las OC pendientes de BI.OC. El catálogo
(código/descripción/categoría/marca) se toma de las tablas locales que ya
sincroniza sync.py.

El resultado se cachea como JSON en meta("compras"); la web solo lee. El
refresh corre fuera de Vercel (BI.Negativos tarda ~45 s) vía GitHub Actions
o en un thread local.
"""
from datetime import datetime

import config
import db
import gbp

# Palabras clave de categorías (idénticas al logic.py de referencia).
PRINT_CATS = [
    "toner", "cartuch", "cabezal", "impresor", "plotter",
    "kit de mantenimiento", "cintas matriciales", "tambores", "papel", "scanner",
]
STORE_CATS = [
    "climatizacion", "pequeños cocina", "heladeras", "freezer", "cavas",
    "rollers", "monopatines", "skates", "jardín", "jardin", "exteriores",
    "muebles", "limpieza", "organizacion", "organización", "lavadero",
    "cocinas", "hornos", "lavado", "cuidado personal",
    "equipamiento comercial", "electrodomesticos", "electrodomésticos",
    "herramientas", "bicicletas", "seguridad medica",
]


def _i(v, default=0):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


def clasificar_categoria(categoria):
    cat = (categoria or "").lower()
    if any(k in cat for k in PRINT_CATS):
        return "impresion"
    if any(k in cat for k in STORE_CATS):
        return "tiendas"
    return "hardware"


def analizar(items, total_skus_universo=None, skus_con_oc_universo=None):
    """Corre el análisis sobre `items` (lista de dicts con las claves de
    ItemInput). Devuelve un dict con las listas y el resumen."""
    out = {"negativos": [], "impresion": [], "tiendas": [], "hardware": [],
           "ml_full": [], "transferencias": [], "resumen": {}}

    total_skus = con_neg = con_transf = total_falta_comprar = oks = oc_skus = 0
    falt_jura_abs = falt_tml_abs = con_neg_ml = falt_ml_abs = 0

    for r in items:
        total_skus += 1
        disp_jura = r["disp_jura"]
        disp_tml = r["disp_tml"]
        disp_ml = r["disp_ml"]
        oc = r["oc"]

        # ---- ML Full: solo disponibles negativos ----
        if disp_ml < 0:
            con_neg_ml += 1
            falt_ml_abs += abs(disp_ml)
            out["ml_full"].append({
                "item_id": r["item_id"], "sku": r["codigo"],
                "descripcion": r["descripcion"], "stk_ml_full": r["stk_ml"],
                "disp_ml_full": disp_ml, "oc": oc,
            })

        # ---- Negativos / Transferencias ----
        if disp_jura < 0 or disp_tml < 0:
            con_neg += 1
        falt_jura_abs += abs(min(0, disp_jura))
        falt_tml_abs += abs(min(0, disp_tml))
        if oc > 0:
            oc_skus += 1

        transf = None
        dj_adj, dt_adj = disp_jura, disp_tml
        if disp_jura > 0 and disp_tml < 0:
            qty = min(disp_jura, abs(disp_tml))
            if qty > 0:
                transf = ("Jura", "TML", qty)
                dj_adj -= qty
                dt_adj += qty
        elif disp_tml > 0 and disp_jura < 0:
            qty = min(disp_tml, abs(disp_jura))
            if qty > 0:
                transf = ("TML", "Jura", qty)
                dj_adj += qty
                dt_adj -= qty

        falta_desp_trans = abs(min(0, dj_adj)) + abs(min(0, dt_adj))
        falta_comprar = max(0, falta_desp_trans - oc)
        ok_compra = falta_comprar == 0

        if transf:
            con_transf += 1
            desde, hacia, qty = transf
            out["transferencias"].append({
                "item_id": r["item_id"], "sku": r["codigo"],
                "descripcion": r["descripcion"],
                "desde": desde, "hacia": hacia, "cantidad": qty,
            })
            continue  # igual que el script: no entra a Negativos

        if disp_jura < 0 or disp_tml < 0:
            row = {
                "item_id": r["item_id"], "sku": r["codigo"],
                "descripcion": r["descripcion"], "categoria": r["categoria"],
                "stk_jura": r["stk_jura"], "disp_jura": disp_jura,
                "stk_tml": r["stk_tml"], "disp_tml": disp_tml, "oc": oc,
                "falta_comprar": falta_comprar, "ok_compra": ok_compra,
            }
            out["negativos"].append(row)
            total_falta_comprar += falta_comprar
            if ok_compra:
                oks += 1
            out[clasificar_categoria(r["categoria"])].append(row)

    # Orden: Falta_Comprar desc, luego SKU.
    def by_falta(x):
        return (-x["falta_comprar"], x["sku"])
    for k in ("negativos", "impresion", "tiendas", "hardware"):
        out[k].sort(key=by_falta)
    out["ml_full"].sort(key=lambda x: (x["disp_ml_full"], x["sku"]))

    if total_skus_universo is not None:
        total_skus = total_skus_universo
    if skus_con_oc_universo is not None:
        oc_skus = skus_con_oc_universo

    pct_ok = round(oks / total_skus * 100, 1) if total_skus else 0.0
    out["resumen"] = {
        "total_skus": total_skus, "con_negativo": con_neg,
        "con_transferencia": con_transf, "skus_con_oc": oc_skus,
        "total_falta_comprar": total_falta_comprar,
        "faltante_jura_abs": falt_jura_abs, "faltante_tml_abs": falt_tml_abs,
        "con_negativo_ml_full": con_neg_ml, "faltante_ml_full_abs": falt_ml_abs,
        "skus_ok": oks, "pct_ok": pct_ok,
    }
    return out


def _status(con, state, step="", detail=""):
    db.set_meta(con, "compras_status", {
        "state": state, "step": step, "detail": detail,
        "at": datetime.now().isoformat(timespec="seconds"),
    })
    print(f"[compras] {step} {detail}".rstrip(), flush=True)


def refresh(con=None):
    """Trae BI.Negativos + BI.OC, corre el análisis y lo cachea en meta.

    Se puede pasar una conexión (para compartir con sync.run_sync) o dejar que
    abra la suya. Devuelve el resumen."""
    own = con is None
    if own:
        con = db.connect()
    try:
        _status(con, "running", "Calculando disponibles en el ERP (~45 s)…")
        neg_rows = gbp.fetch("wsGBPScriptExecute4Dataset",
                             strScriptLabel="BI.Negativos", strJSonParameters="")

        _status(con, "running", "Trayendo órdenes de compra pendientes…")
        oc_rows = gbp.fetch("wsGBPScriptExecute4Dataset",
                            strScriptLabel="BI.OC", strJSonParameters="")
        oc_by_item = {_i(r.get("item_id")): _i(r.get("OC")) for r in oc_rows}

        _status(con, "running", "Cruzando con el catálogo…")
        # catálogo local para los item_id que trae BI.Negativos
        neg_ids = [_i(r.get("Item_id")) for r in neg_rows if _i(r.get("Item_id"))]
        maestro = {}
        if neg_ids:
            marks = ",".join("?" for _ in neg_ids)
            for row in con.execute(f"""
                SELECT i.item_id, i.item_code, i.item_desc,
                       c.cat_desc, b.brand_desc
                FROM items i
                LEFT JOIN categories c ON c.cat_id = i.cat_id
                LEFT JOIN brands b ON b.brand_id = i.brand_id
                WHERE i.item_id IN ({marks})
            """, neg_ids):
                maestro[row["item_id"]] = dict(row)

        items = []
        for r in neg_rows:
            iid = _i(r.get("Item_id"))
            art = maestro.get(iid, {})
            items.append({
                "item_id": iid,
                "codigo": r.get("Codigo") or art.get("item_code") or "",
                "descripcion": art.get("item_desc") or "",
                "categoria": art.get("cat_desc") or "",
                "marca": art.get("brand_desc") or "",
                "stk_jura": _i(r.get("Stk_Jura")), "disp_jura": _i(r.get("Disp_Jura")),
                "stk_tml": _i(r.get("Stk_TML")), "disp_tml": _i(r.get("Disp_TML")),
                "stk_ml": _i(r.get("Stk_MLFull")), "disp_ml": _i(r.get("Disp_MLFull")),
                "oc": oc_by_item.get(iid, 0),
            })

        total_skus = con.execute(
            "SELECT COUNT(*) c FROM items WHERE disabled = 0").fetchone()["c"]
        skus_con_oc = 0
        if oc_by_item:
            ids = [i for i in oc_by_item if i]
            if ids:
                marks = ",".join("?" for _ in ids)
                skus_con_oc = con.execute(
                    f"SELECT COUNT(*) c FROM items "
                    f"WHERE disabled = 0 AND item_id IN ({marks})", ids
                ).fetchone()["c"]

        analysis = analizar(items, total_skus, skus_con_oc)
        analysis["updated_at"] = datetime.now().isoformat(timespec="seconds")
        db.set_meta(con, "compras", analysis)
        _status(con, "ok", "")
        print(f"[compras] OK: {analysis['resumen']['con_negativo']} negativos, "
              f"falta comprar {analysis['resumen']['total_falta_comprar']}",
              flush=True)
        return analysis["resumen"]
    except Exception as e:
        _status(con, "error", "", str(e)[:200])
        raise
    finally:
        if own:
            con.close()


if __name__ == "__main__":
    refresh()
