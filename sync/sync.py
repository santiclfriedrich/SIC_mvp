# -*- coding: utf-8 -*-
"""Sincroniza el ERP GlobalBluePoint -> SQLite local.

Se puede correr suelto (python sync.py) o desde el servidor web en un thread.
El progreso se publica en la tabla meta (clave "sync") para que la UI lo muestre.
"""
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import config
import db
import gbp


# upserts portables (SQLite / Postgres)
UPSERT_ITEMS = db.upsert("items", (
    "item_id", "item_code", "item_desc", "item_detail", "vendor_code",
    "cat_id", "subcat_id", "brand_id", "supp_id", "disabled", "not4sale",
    "weight", "stock_total"), ("item_id",))
UPSERT_STOCK = db.upsert("stock", ("item_id", "stor_id", "fs", "ps"),
                         ("item_id", "stor_id"))
UPSERT_PRICES = db.upsert("prices", ("prli_id", "item_id", "price", "curr_id"),
                          ("prli_id", "item_id"))
UPSERT_COSTS = db.upsert(
    "costs", ("item_id", "cost", "cost_ppp", "cost_curr", "cost_orig"),
    ("item_id",))
UPSERT_FICHA_MISS = db.upsert("ficha_miss", ("item_id", "checked_at"),
                              ("item_id",))


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _i(v, default=None):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


def _b(v):
    return 1 if str(v).lower() == "true" else 0


def _progress(con, step, detail="", pct=0, state="running"):
    db.set_meta(con, "sync", {
        "state": state, "step": step, "detail": detail, "pct": pct,
        "at": datetime.now().isoformat(timespec="seconds"),
    })
    print(f"[sync] {step} {detail} ({pct}%)", flush=True)


def _ps(v):
    """Disponible. 99999999 es un centinela del ERP ("sin límite propio",
    típico de combos) -> NULL para no ensuciar las sumas."""
    x = _f(v)
    return None if x >= 99999999 else x


def _fetch_storage_stock(stor_id):
    """Stock de un depósito. Devuelve también TODOS los item_id que informa
    el ERP (incluidos los que están en 0): es el universo real de artículos,
    más completo que el catálogo de Item_funGetXMLData."""
    rows = gbp.fetch("ItemStorage_funGetXMLData", intStor_id=stor_id,
                     intItem_id=-1)
    all_ids = {_i(r.get("item_id")) for r in rows if _i(r.get("item_id"))}
    stock = [
        (_i(r.get("item_id")), stor_id, _f(r.get("FS")), _ps(r.get("PS")))
        for r in rows
        if _i(r.get("item_id")) and (_f(r.get("FS")) or _ps(r.get("PS")))
    ]
    return stor_id, stock, all_ids


def apply_storage_names(con):
    """Nombres reales de los depósitos vía GBPScript (si existe). Los del
    mapeo manual (config.STORAGE_NAMES) tienen prioridad."""
    if not config.GBPSCRIPT_STORAGES_LABEL:
        return 0
    try:
        rows = gbp.fetch("wsGBPScriptExecute4Dataset",
                         strScriptLabel=config.GBPSCRIPT_STORAGES_LABEL,
                         strJSonParameters="{}")
    except Exception:
        return 0
    n = 0
    for r in rows:
        low = {k.lower(): v for k, v in r.items()}
        sid = _i(low.get("stor_id"))
        name = (low.get("stor_desc") or "").strip()
        if sid and name and sid not in config.STORAGE_NAMES:
            cur = con.execute(
                "UPDATE storages SET stor_name = ? WHERE stor_id = ?",
                (name, sid))
            n += cur.rowcount
    con.commit()
    return n


def _fetch_item_ficha(item_id):
    """Ficha de un artículo vía Producteca (módulo 45). A diferencia de
    Item_funGetXMLData, este método no filtra artículos fuera del catálogo
    web, así que sirve para completar los que tienen stock pero no ficha."""
    rows = gbp.fetch("wsProducteca_Item_funGetXMLDataById", intItemID=item_id)
    if not rows:
        return None
    r = rows[0]
    if not _i(r.get("item_id")):
        return None
    return (_i(r.get("item_id")), r.get("item_code"), r.get("item_desc"),
            r.get("item_detail"), r.get("item_vendorCode"),
            _i(r.get("cat_id")), _i(r.get("subcat_id")),
            _i(r.get("brand_id")), _i(r.get("supp_id")),
            _b(r.get("item_disabled")), _b(r.get("item_not4Sale")),
            _f(r.get("item_weight")), 0.0)


def sync_missing_items(con, universe=None):
    """Completa las fichas que Item_funGetXMLData filtra. El universo de IDs
    sale del stock por depósito (lista todos los artículos, aun en 0). Los
    IDs que ningún método devuelve (dados de baja) se cachean en ficha_miss
    para no reconsultarlos en cada sincronización."""
    if universe is None:
        # corrida suelta: el universo se saca de un depósito cualquiera
        _, _, universe = _fetch_storage_stock(config.VISIBLE_STORAGES[0])
    known = {r["item_id"] for r in con.execute("SELECT item_id FROM items")}
    missed = {r["item_id"] for r in con.execute("SELECT item_id FROM ficha_miss")}
    orphans = {r["item_id"] for r in con.execute("""
        SELECT DISTINCT s.item_id FROM stock s
        WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.item_id = s.item_id)
    """)}
    # los huérfanos con stock se reintentan siempre; el resto solo si es nuevo
    ids = sorted((set(universe) - known - missed) | (orphans - known))
    if not ids:
        return 0
    results, not_found, done = [], [], 0
    with ThreadPoolExecutor(max_workers=config.COST_FETCH_WORKERS) as pool:
        futures = {pool.submit(_fetch_item_ficha, i): i for i in ids}
        for fut in as_completed(futures):
            item_id = futures[fut]
            try:
                res = fut.result()
            except Exception:
                res = None
            if res:
                results.append(res)
            else:
                not_found.append(item_id)
            done += 1
            if done % 100 == 0 or done == len(ids):
                _progress(con, "Fichas faltantes",
                          f"{done}/{len(ids)} artículos consultados",
                          65 + int(7 * done / len(ids)))
    cur = con.cursor()
    cur.executemany(
        UPSERT_ITEMS,
        results)
    now = datetime.now().isoformat(timespec="seconds")
    cur.executemany(
        UPSERT_FICHA_MISS,
        [(i, now) for i in not_found])
    vis = ",".join(str(int(s)) for s in config.VISIBLE_STORAGES)
    cur.execute(f"""
        UPDATE items SET stock_total = COALESCE(
            (SELECT SUM(fs) FROM stock
             WHERE stock.item_id = items.item_id
               AND stock.stor_id IN ({vis})), 0)
    """)
    con.commit()
    return len(results)


def _fetch_cost(item_id):
    """Costo (lista de costos) de un artículo. Devuelve también el ratio
    ARS/USD del ERP (cotización) cuando el precio original está en USD.
    Solo responde para artículos publicables; el resto da vacío."""
    rows = gbp.fetch("MercadoLibre_PriceListItems_funGetXMLDataV2",
                     intPriceListID=config.DEFAULT_PRICE_LIST,
                     intItemID=item_id, intCostListID=config.COST_LIST_ID)
    if not rows:
        return None
    r = rows[0]
    cost, ppp = _f(r.get("coslis_price")), _f(r.get("coslis_priceAW"))
    ratio = None
    price, orig = _f(r.get("prli_price")), _f(r.get("prli_priceOriginal"))
    if r.get("curr_idOriginal") == "2" and orig > 0 and price > 0:
        ratio = price / orig
    if not cost and not ppp:
        return None
    return item_id, cost, ppp, ratio


def _fetch_bulk_costs():
    """Filas de costos masivos: primero GBPScript (módulo 73), después la
    Consulta Personalizada (wsExportDataById). Devuelve lista o None."""
    if config.GBPSCRIPT_COSTS_LABEL:
        try:
            rows = gbp.fetch("wsGBPScriptExecute4Dataset",
                             strScriptLabel=config.GBPSCRIPT_COSTS_LABEL,
                             strJSonParameters="{}")
            if rows and "item_id" in {k.lower() for k in rows[0]}:
                return rows
        except Exception:
            pass
    if config.EXPORT_COSTS_QUERY_ID:
        try:
            return gbp.fetch("wsExportDataById",
                             intExpgr_id=config.EXPORT_COSTS_QUERY_ID)
        except Exception:
            pass
    return None


def _costs_from_export(con):
    """Costos masivos (GBPScript o Consulta Personalizada).
    Devuelve (filas, cotización) o (None, None) si no hay fuente masiva."""
    rows = _fetch_bulk_costs()
    if not rows:
        return None, None
    out, cotizacion = [], None
    for r in rows:
        low = {k.lower(): v for k, v in r.items()}
        iid = _i(low.get("item_id"))
        cost = _f(low.get("costo") or low.get("coslis_price"))
        ppp = _f(low.get("costo_ppp") or low.get("coslis_price_aw")) or cost
        curr = str(low.get("moneda_id") or low.get("curr_id") or "1")
        cot = _f(low.get("cotizacion"))
        if cot:
            cotizacion = cot
        if not iid or (not cost and not ppp):
            continue
        cost_orig = cost                       # valor tal como está en el ERP
        moneda = "USD" if curr == "2" else "ARS"
        if curr == "2" and cot:                # costo cargado en USD -> pesos
            cost, ppp = cost * cot, ppp * cot
        out.append((iid, cost, ppp, moneda, cost_orig))
    return (out, cotizacion) if out else (None, None)


def sync_costs(con, item_ids):
    """Trae los costos y los guarda. Primero intenta la Consulta Personalizada
    (masiva, cubre todo); si no está disponible, consulta artículo por
    artículo vía el método ML (solo artículos habilitados para web)."""
    export_rows, export_cot = _costs_from_export(con)
    if export_rows:
        cur = con.cursor()
        cur.execute("DELETE FROM costs")
        cur.executemany(UPSERT_COSTS, export_rows)
        con.commit()
        if export_cot:
            db.set_meta(con, "cotizacion", round(export_cot, 2))
        _progress(con, "Costos",
                  f"{len(export_rows)} costos vía consulta personalizada", 95)
        return len(export_rows), export_cot

    results, ratios, done = [], [], 0
    with ThreadPoolExecutor(max_workers=config.COST_FETCH_WORKERS) as pool:
        futures = {pool.submit(_fetch_cost, i): i for i in item_ids}
        for fut in as_completed(futures):
            try:
                res = fut.result()
            except Exception:
                res = None
            if res:
                item_id, cost, ppp, ratio = res
                # el método ML devuelve el costo ya en ARS
                results.append((item_id, cost, ppp, "ARS", cost))
                if ratio:
                    ratios.append(ratio)
            done += 1
            if done % 100 == 0 or done == len(item_ids):
                _progress(con, "Costos",
                          f"{done}/{len(item_ids)} artículos consultados",
                          75 + int(20 * done / max(1, len(item_ids))))
    cur = con.cursor()
    cur.execute("DELETE FROM costs")
    cur.executemany(UPSERT_COSTS, results)
    con.commit()
    cotizacion = None
    if ratios:
        ratios.sort()
        cotizacion = round(ratios[len(ratios) // 2], 2)  # mediana
        db.set_meta(con, "cotizacion", cotizacion)
    return len(results), cotizacion


def _es_mercaderia(cat_id):
    """False para categorías contables (servicios, ajustes) que no son stock."""
    return _i(cat_id) not in set(config.EXCLUDED_CATEGORIES)


def _fetch_stock_gbpscript():
    """Stock por depósito vía GBPScript BI.Stock (tbItemStorage directo, sin
    el filtro del WS). Devuelve (stock_rows, universe) o (None, None)."""
    if not config.GBPSCRIPT_STOCK_LABEL:
        return None, None
    try:
        rows = gbp.fetch("wsGBPScriptExecute4Dataset",
                         strScriptLabel=config.GBPSCRIPT_STOCK_LABEL,
                         strJSonParameters="{}")
    except Exception as e:
        print(f"[sync] BI.Stock no disponible ({e}); uso ItemStorage", flush=True)
        return None, None
    if not rows or "item_id" not in {k.lower() for k in rows[0]}:
        return None, None
    visibles = set(int(s) for s in config.VISIBLE_STORAGES)
    stock_rows, universe = [], set()
    for r in rows:
        low = {k.lower(): v for k, v in r.items()}
        iid = _i(low.get("item_id"))
        sid = _i(low.get("stor_id"))
        if not iid or sid not in visibles:
            continue
        universe.add(iid)
        fs = _f(low.get("fs"))
        ps = _ps(low.get("ps"))
        if fs or ps:
            stock_rows.append((iid, sid, fs, ps))
    return stock_rows, universe


def _fetch_catalogo():
    """Catálogo de artículos. Devuelve (filas, es_completo).

    Preferimos el GBPScript BI.Articulos (trae TODO tbItem, ~15k); si no
    existe, caemos a Item_funGetXMLData (filtrado, ~8k) + el rescate por
    stock/Producteca que hace sync_missing_items. Se excluyen las
    categorías no-mercadería (config.EXCLUDED_CATEGORIES)."""
    if config.GBPSCRIPT_ITEMS_LABEL:
        try:
            rows = gbp.fetch("wsGBPScriptExecute4Dataset",
                             strScriptLabel=config.GBPSCRIPT_ITEMS_LABEL,
                             strJSonParameters="{}")
            if rows and "item_id" in {k.lower() for k in rows[0]}:
                out = []
                for r in rows:
                    low = {k.lower(): v for k, v in r.items()}
                    if not _es_mercaderia(low.get("cat_id")):
                        continue
                    dis = str(low.get("item_disabled", "0")).strip().lower()
                    n4s = str(low.get("item_not4sale", "0")).strip().lower()
                    out.append({
                        "item_id": low.get("item_id"),
                        "item_code": low.get("item_code"),
                        "item_desc": low.get("item_desc"),
                        "item_detail": low.get("item_detail"),
                        "item_vendorCode": low.get("item_vendorcode"),
                        "cat_id": low.get("cat_id"),
                        "subcat_id": low.get("subcat_id"),
                        "brand_id": low.get("brand_id"),
                        "supp_id": low.get("supp_id"),
                        # normalizar a "true"/"false" (formato de _b)
                        "item_disabled": "true" if dis in ("1", "true") else "false",
                        "item_not4Sale": "true" if n4s in ("1", "true") else "false",
                        "item_weight": low.get("item_weight"),
                    })
                return out, True
        except Exception as e:
            print(f"[sync] BI.Articulos no disponible ({e}); uso el WS", flush=True)
    ws = [r for r in gbp.fetch("Item_funGetXMLData")
          if _es_mercaderia(r.get("cat_id"))]
    return ws, False


def run_sync():
    con = db.connect()
    t0 = time.time()
    try:
        _progress(con, "Conectando al ERP...", pct=2)
        gbp.reset_connection()

        # --- catálogos chicos ---
        _progress(con, "Catálogos", "monedas, listas, categorías, marcas", 5)
        currencies = gbp.fetch("Currency_funGetXMLData")
        price_lists = gbp.fetch("PriceList_funGetXMLData")
        categories = gbp.fetch("Category_funGetXMLData")
        brands = gbp.fetch("Brand_funGetXMLData")
        branches = gbp.fetch("Branch_funGetXMLData")

        # --- artículos: catálogo completo (GBPScript) o el WS filtrado ---
        _progress(con, "Artículos", "descargando catálogo completo", 15)
        items, items_completo = _fetch_catalogo()
        _progress(con, "Artículos",
                  f"{len(items)} artículos recibidos"
                  + (" (catálogo completo)" if items_completo else ""), 35)

        # --- stock por depósito: GBPScript (completo) o ItemStorage del WS ---
        storage_ids = [int(s) for s in config.VISIBLE_STORAGES]
        stock_rows, universe = _fetch_stock_gbpscript()
        if stock_rows is not None:
            _progress(con, "Stock",
                      f"{len(stock_rows)} filas (BI.Stock)", 55)
        else:
            # fallback: ItemStorage del WS, depósito por depósito (filtrado)
            _progress(con, "Stock", f"{len(storage_ids)} depósitos", 40)
            stock_rows, universe, done = [], set(), 0
            with ThreadPoolExecutor(max_workers=config.SYNC_WORKERS) as pool:
                futures = {pool.submit(_fetch_storage_stock, s): s
                           for s in storage_ids}
                for fut in as_completed(futures):
                    stor_id, rows, all_ids = fut.result()
                    stock_rows.extend(rows)
                    universe |= all_ids
                    done += 1
                    _progress(con, "Stock",
                              f"depósito {stor_id} listo ({done}/{len(storage_ids)})",
                              40 + int(15 * done / len(storage_ids)))

        # --- precios de las listas configuradas ---
        prices = []
        for n, prli in enumerate(config.SYNC_PRICE_LISTS, 1):
            _progress(con, "Precios", f"lista {prli}", 55 + int(10 * (n - 1) / len(config.SYNC_PRICE_LISTS)))
            rows = gbp.fetch("PriceListItems_funGetXMLData",
                             pPriceList=prli, pItem=-1)
            prices.extend(
                (prli, _i(r.get("item_id")), _f(r.get("prli_price")),
                 _i(r.get("curr_id"), 1))
                for r in rows if _i(r.get("item_id"))
            )

        # --- escritura atómica ---
        _progress(con, "Guardando", "escribiendo base local", 63)
        cur = con.cursor()
        tablas = ["categories", "brands", "branches", "storages", "stock",
                  "price_lists", "prices", "currencies"]
        # Con catálogo completo (BI.Articulos) vaciamos items: es la lista
        # canónica y así se van los artículos dados de baja. Con el WS
        # filtrado NO se vacía (las fichas rescatadas deben sobrevivir).
        if items_completo:
            tablas += ["items", "ficha_miss"]
        for table in tablas:
            cur.execute(f"DELETE FROM {table}")

        cur.executemany(
            "INSERT INTO currencies VALUES (?,?,?)",
            [(_i(r.get("curr_id")), r.get("curr_desc"), r.get("curr_symbol"))
             for r in currencies if _i(r.get("curr_id"))])
        cur.executemany(
            "INSERT INTO price_lists VALUES (?,?)",
            [(_i(r.get("prli_id")), r.get("prli_desc"))
             for r in price_lists if _i(r.get("prli_id"))])
        cur.executemany(
            "INSERT INTO categories VALUES (?,?)",
            [(_i(r.get("cat_id")), r.get("cat_desc"))
             for r in categories if _i(r.get("cat_id"))])
        cur.executemany(
            "INSERT INTO brands VALUES (?,?)",
            [(_i(r.get("brand_id")), r.get("brand_desc"))
             for r in brands if _i(r.get("brand_id"))])
        cur.executemany(
            "INSERT INTO branches VALUES (?,?)",
            [(_i(r.get("bra_id")), r.get("bra_desc"))
             for r in branches if _i(r.get("bra_id"))])
        cur.executemany(
            "INSERT INTO storages VALUES (?,?)",
            [(s, config.STORAGE_NAMES.get(s, f"Depósito {s}"))
             for s in storage_ids])
        cur.executemany(
            UPSERT_ITEMS,
            [(_i(r.get("item_id")), r.get("item_code"), r.get("item_desc"),
              r.get("item_detail"), r.get("item_vendorCode"),
              _i(r.get("cat_id")), _i(r.get("subcat_id")),
              _i(r.get("brand_id")), _i(r.get("supp_id")),
              _b(r.get("item_disabled")), _b(r.get("item_not4Sale")),
              _f(r.get("item_weight")), _f(r.get("stock")))
             for r in items if _i(r.get("item_id"))])
        cur.executemany(
            UPSERT_STOCK, stock_rows)
        cur.executemany(
            UPSERT_PRICES, prices)

        # total por artículo: solo depósitos visibles en el panel
        vis = ",".join(str(int(s)) for s in config.VISIBLE_STORAGES)
        cur.execute(f"""
            UPDATE items SET stock_total = COALESCE(
                (SELECT SUM(fs) FROM stock
                 WHERE stock.item_id = items.item_id
                   AND stock.stor_id IN ({vis})), 0)
        """)
        con.commit()

        # --- nombres reales de depósitos (GBPScript, si existe) ---
        apply_storage_names(con)

        # --- fichas faltantes: solo si el catálogo vino filtrado (sin
        # BI.Articulos). Con catálogo completo no hace falta rescatar nada. ---
        if items_completo:
            n_fichas = 0
        else:
            n_fichas = sync_missing_items(con, universe)
            _progress(con, "Fichas faltantes",
                      f"{n_fichas} artículos sumados", 72)

        # --- costos: la fuente principal es el export masivo BI.Costos, que
        #     cubre TODOS los artículos (con o sin stock). La lista de abajo es
        #     solo el fallback artículo-por-artículo para cuando ese WS masivo
        #     no responde; la ampliamos a toda la mercadería (no solo lo que
        #     tiene stock) para que el costo quede cacheado igual y el detalle
        #     de Artículos no dependa de una consulta en vivo al ERP. ---
        _excl = ",".join(str(c) for c in config.EXCLUDED_CATEGORIES) or "0"
        cost_items = [r["item_id"] for r in con.execute(
            "SELECT item_id FROM items WHERE disabled = 0 "
            f"AND (cat_id IS NULL OR cat_id NOT IN ({_excl}))")]
        _progress(con, "Costos",
                  f"preparando costos de {len(cost_items)} artículos", 65)
        n_costs, cotizacion = sync_costs(con, cost_items)

        # --- stock de SGL (depósito TML tercerizado), para Diferencias ---
        try:
            import sgl
            _progress(con, "SGL", "consultando stock del depósito TML", 96)
            n_sgl, _snap = sgl.sync_sgl(con)
            _progress(con, "SGL", f"{n_sgl} SKUs actualizados", 98)
        except Exception as e:
            # SGL caído no frena la sincronización principal
            print(f"[sync] SGL no disponible: {e}", flush=True)

        # --- ventas recientes (el histórico se carga con ventas.py --backfill) ---
        try:
            import ventas
            _progress(con, "Ventas", "actualizando ventas recientes", 99)
            n_v = ventas.refresh_reciente(45)
            print(f"[sync] ventas recientes: {n_v} líneas", flush=True)
        except Exception as e:
            print(f"[sync] ventas no disponible: {e}", flush=True)

        # --- Compras: negativos / falta comprar (BI.Negativos + BI.OC) ---
        try:
            import compras
            _progress(con, "Compras", "calculando negativos", 99)
            res = compras.refresh(con)
            print(f"[sync] compras: {res.get('con_negativo')} negativos",
                  flush=True)
        except Exception as e:
            print(f"[sync] compras no disponible: {e}", flush=True)

        db.set_meta(con, "last_sync", {
            "at": datetime.now().isoformat(timespec="seconds"),
            "seconds": round(time.time() - t0),
            "items": len(items), "stock_rows": len(stock_rows),
            "storages": len(storage_ids), "prices": len(prices),
            "costs": n_costs, "cotizacion": cotizacion,
            "fichas_extra": n_fichas,
        })
        _progress(con, "Listo", f"sincronizado en {round(time.time()-t0)} s",
                  100, state="done")
    except Exception as e:
        traceback.print_exc()
        _progress(con, "Error", str(e), 0, state="error")
        raise
    finally:
        con.close()


if __name__ == "__main__":
    if "--probar-scripts" in sys.argv:
        # prueba los GBPScripts BI.Costos y BI.Depositos en vivo
        for label in (config.GBPSCRIPT_COSTS_LABEL,
                      config.GBPSCRIPT_STORAGES_LABEL):
            try:
                rows = gbp.fetch("wsGBPScriptExecute4Dataset",
                                 strScriptLabel=label, strJSonParameters="{}")
                print(f"{label}: {len(rows)} filas")
                for r in rows[:3]:
                    print("  ", r)
            except Exception as e:
                print(f"{label}: ERROR {e}")
    elif "--detectar-consulta" in sys.argv:
        # busca la Consulta Personalizada de costos entre los IDs del WS
        print("escaneando consultas 1..150 buscando columnas de costo...")
        found = None
        for expgr in range(1, 151):
            try:
                rows = gbp.fetch("wsExportDataById", intExpgr_id=expgr)
            except Exception:
                continue
            if rows and any(k.lower() in ("costo", "coslis_price")
                            for k in rows[0]):
                found = expgr
                print(f"  -> ID {expgr}: columnas {list(rows[0])[:8]}")
                break
        print(f"consulta de costos: {found or 'NO encontrada'}"
              f"{' — poner en config.EXPORT_COSTS_QUERY_ID' if found else ''}")
    elif "--solo-fichas" in sys.argv:
        con = db.connect()
        n = sync_missing_items(con)
        _progress(con, "Listo", f"fichas sumadas ({n})", 100, state="done")
        print(f"fichas sumadas: {n}")
        con.close()
    elif "--solo-costos" in sys.argv:
        # backfill de costos sobre la base ya sincronizada
        con = db.connect()
        ids = [r["item_id"] for r in con.execute(
            "SELECT item_id FROM items WHERE disabled = 0 AND stock_total > 0")]
        print(f"consultando costos de {len(ids)} artículos...")
        n, cot = sync_costs(con, ids)
        _progress(con, "Listo", f"costos actualizados ({n})", 100,
                  state="done")
        print(f"costos guardados: {n} · cotización deducida: {cot}")
        con.close()
    else:
        run_sync()
    sys.exit(0)
