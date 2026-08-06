# -*- coding: utf-8 -*-
"""Ventas: carga el detalle de ventas del ERP (GBPScript BI.Ventas) a la
tabla local `sales`, para la sección de Ventas del panel.

- backfill(desde_anio): carga histórica mes a mes (se corre una vez).
- refresh_reciente(dias): refresca los últimos N días (lo usa el sync horario).

BI.Ventas recibe {"desde": yyyymmdd, "hasta": yyyymmdd} con `hasta` EXCLUSIVO.
Las notas de crédito ya vienen con cantidad/importe en negativo.
"""
import json
from datetime import date, datetime, timedelta

import config
import db
import gbp


def _f(v):
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return 0.0


def _fecha_iso(v):
    """Fecha_Mov viene 'yyyy/mm/dd' -> 'yyyy-mm-dd'."""
    s = str(v or "").strip().replace("/", "-")
    return s[:10]


def _clasificar_tipo(comprobante, total):
    """Tipo de comprobante desde su texto (el ERP manda 'Tipo' vacío):
    FC = Factura, NC = Nota de Crédito, ND = Nota de Débito.
    Fallback por signo si el texto no coincide."""
    c = (comprobante or "").strip().lower()
    if c.startswith("nota de cr"):
        return "NC"
    if c.startswith("nota de d"):   # nota de débito
        return "ND"
    if c.startswith("factura"):
        return "FC"
    return "NC" if total < 0 else "FC"


def _fetch_rango(desde, hasta):
    """Trae las líneas de venta entre dos date (hasta exclusivo en el WS)."""
    params = json.dumps({"desde": int(desde.strftime("%Y%m%d")),
                         "hasta": int(hasta.strftime("%Y%m%d"))})
    rows = gbp.fetch("wsGBPScriptExecute4Dataset",
                     strScriptLabel="BI.Ventas", strJSonParameters=params)
    out = []
    for r in rows:
        if "GenerationError" in r:
            raise RuntimeError(r["GenerationError"])
        g = lambda k: (r.get(k) or "").strip()
        cant = _f(r.get("Cantidad"))
        total = _f(r.get("Precio_Total"))
        neto = _f(r.get("Precio_Neto")) * cant   # unitario neto * cantidad
        comp = g("Comprobante")
        out.append((
            _fecha_iso(r.get("Fecha_Mov")), g("Sucursal"), g("Vendedor"),
            g("Cliente"), g("Clase_de_Cliente"), comp,
            g("Condicion_Venta"), _clasificar_tipo(comp, total),
            g("Codigo"), g("Descripcion"), g("Marca"), g("Categoria"),
            g("SubCategoria"), cant, total, neto, _f(r.get("TC_Cbte")),
        ))
    return out


COLS = ("fecha", "sucursal", "vendedor", "cliente", "clase_cliente",
        "comprobante", "condicion", "tipo", "item_code", "item_desc", "marca",
        "categoria", "subcategoria", "cantidad", "total", "neto", "tc")
_PH = ",".join(["?"] * len(COLS))
INSERT_SALES = f"INSERT INTO sales ({','.join(COLS)}) VALUES ({_PH})"


def _guardar(con, desde, hasta, filas):
    """Reemplaza las ventas del rango [desde, hasta) por las filas nuevas."""
    cur = con.cursor()
    cur.execute("DELETE FROM sales WHERE fecha >= ? AND fecha < ?",
                (desde.strftime("%Y-%m-%d"), hasta.strftime("%Y-%m-%d")))
    if filas:
        cur.executemany(INSERT_SALES, filas)
    con.commit()


def _meses(desde, hasta):
    """Genera (inicio, fin) por mes entre dos fechas (fin exclusivo)."""
    cur = date(desde.year, desde.month, 1)
    while cur < hasta:
        if cur.month == 12:
            nxt = date(cur.year + 1, 1, 1)
        else:
            nxt = date(cur.year, cur.month + 1, 1)
        yield max(cur, desde), min(nxt, hasta)
        cur = nxt


def backfill(desde_anio=2025, log=print):
    """Carga histórica mes a mes desde el 1/1/desde_anio hasta hoy+1."""
    con = db.connect()
    inicio = date(desde_anio, 1, 1)
    fin = date.today() + timedelta(days=1)
    total = 0
    for m_ini, m_fin in _meses(inicio, fin):
        filas = _fetch_rango(m_ini, m_fin)
        _guardar(con, m_ini, m_fin, filas)
        total += len(filas)
        log(f"  {m_ini:%Y-%m}: {len(filas)} líneas (acum {total})")
    db.set_meta(con, "ventas_info", {
        "at": datetime.now().isoformat(timespec="seconds"),
        "desde": inicio.strftime("%Y-%m-%d"), "lineas": total,
    })
    con.close()
    return total


def refresh_reciente(dias=45):
    """Refresca los últimos `dias` (lo llama el sync horario)."""
    con = db.connect()
    hasta = date.today() + timedelta(days=1)
    desde = date.today() - timedelta(days=dias)
    filas = _fetch_rango(desde, hasta)
    _guardar(con, desde, hasta, filas)
    info = db.get_meta(con, "ventas_info") or {}
    info.update({"at": datetime.now().isoformat(timespec="seconds"),
                 "reciente_dias": dias})
    db.set_meta(con, "ventas_info", info)
    con.close()
    return len(filas)


if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8",
                                  errors="replace")
    if "--backfill" in sys.argv:
        anio = 2025
        for a in sys.argv:
            if a.isdigit():
                anio = int(a)
        print(f"backfill de ventas desde {anio}...")
        n = backfill(anio)
        print(f"listo: {n} líneas cargadas")
    else:
        n = refresh_reciente()
        print(f"ventas recientes actualizadas: {n} líneas")
