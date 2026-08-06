# -*- coding: utf-8 -*-
"""Cliente de la API de SGL (sistema de gestión del depósito TML).

⚠ SOLO se usa el endpoint de LECTURA GetStock. Los endpoints GetDocumentos /
InsertDocumentos crean órdenes de trabajo y NO deben llamarse (los usa GBP).

El stock viene desglosado por estado; para comparar contra el stock físico
de GBP se usa el estado "FISICO" (validado contra datos reales: coincide
exacto en ~83% de los artículos; el resto son diferencias genuinas).
"""
import time
from datetime import datetime

import requests

import config
import db

_token_cache = {"token": None, "exp": 0}


def _token():
    if _token_cache["token"] and time.time() < _token_cache["exp"] - 60:
        return _token_cache["token"]
    r = requests.post(config.SGL_API_URL + "/api/Token", json={
        "clientId": config.SGL_CLIENT_ID,
        "clientSecret": config.SGL_CLIENT_SECRET,
        "grantType": "client_credentials",
    }, timeout=30)
    r.raise_for_status()
    tok = r.json()["access_token"]
    _token_cache["token"] = tok
    # el JWT dura bastante; renovamos cada 30 min por las dudas
    _token_cache["exp"] = time.time() + 1800
    return tok


def _num(v):
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return 0.0


def fetch_stock():
    """Stock actual en SGL, agregado por SKU.

    Devuelve (filas, snapshot) donde filas = [(sku, fisico, descr)] y
    snapshot es la fecha/hora que informa SGL para la foto.
    """
    url = (f"{config.SGL_API_URL}/api/WMS/Stock/GetStock/"
           f"{int(config.SGL_CLIENTE)}/null/null/true")
    r = requests.get(url, headers={"Authorization": f"Bearer {_token()}"},
                     timeout=180)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list):
        raise RuntimeError(f"Respuesta inesperada de SGL: {str(data)[:120]}")

    excl_pref = tuple(p.upper() for p in config.SGL_EXCLUDE_PREFIXES)
    excl_sku = {s.upper() for s in config.SGL_EXCLUDE_SKUS}

    por_sku = {}
    snapshot = None
    for row in data:
        sku = (row.get("articuloCodigo") or "").strip().upper()
        if not sku:
            continue
        # descartar ubicaciones/etiquetas logísticas (no son mercadería)
        if sku in excl_sku or sku.startswith(excl_pref):
            continue
        estado = (row.get("estadoDescripcion") or "").strip().upper()
        entry = por_sku.setdefault(sku, {"fisico": 0.0, "descr": ""})
        if estado == "FISICO":
            entry["fisico"] += _num(row.get("cantidad"))
        if not entry["descr"]:
            entry["descr"] = (row.get("articuloDescripcion") or "").strip()
        if not snapshot and row.get("fecha"):
            f, h = str(row["fecha"]), str(row.get("hora") or "")
            snapshot = (f"{f[:4]}-{f[4:6]}-{f[6:8]} {h}" if len(f) == 8 else f)
    rows = [(sku, v["fisico"], v["descr"]) for sku, v in por_sku.items()]
    return rows, snapshot


def sync_sgl(con):
    """Actualiza la tabla sgl_stock desde la API. Devuelve (filas, snapshot)."""
    rows, snapshot = fetch_stock()
    if not rows:
        raise RuntimeError("SGL devolvió 0 artículos")
    con.execute("DELETE FROM sgl_stock")
    con.executemany(db.upsert("sgl_stock", ("sku", "qty", "descr"), ("sku",)),
                    rows)
    con.commit()
    db.set_meta(con, "sgl_info", {
        "at": datetime.now().isoformat(timespec="seconds"),
        "file": None, "rows": len(rows),
        "source": "api", "snapshot": snapshot,
    })
    return len(rows), snapshot


if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8",
                                  errors="replace")
    con = db.connect()
    n, snap = sync_sgl(con)
    con.close()
    print(f"SGL actualizado: {n} SKUs (foto {snap})")
