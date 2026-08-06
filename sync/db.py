# -*- coding: utf-8 -*-
"""Capa de datos con doble backend.

- Local (por defecto): SQLite en data/stock.db.
- Nube: si config.DATABASE_URL está definida (Supabase/Postgres), usa psycopg.

El resto del código escribe SQL con placeholders "?" y usa con.execute(...)
como en sqlite3; el wrapper de Postgres traduce los placeholders y expone la
misma interfaz (execute / executemany / cursor / commit / close).
"""
import json
import os
import sqlite3
import threading

import config

IS_PG = bool(config.DATABASE_URL)

# El mismo DDL sirve para SQLite y Postgres (tipos y ON CONFLICT compatibles)
SCHEMA = [
    """CREATE TABLE IF NOT EXISTS items (
        item_id     INTEGER PRIMARY KEY,
        item_code   TEXT,
        item_desc   TEXT,
        item_detail TEXT,
        vendor_code TEXT,
        cat_id      INTEGER,
        subcat_id   INTEGER,
        brand_id    INTEGER,
        supp_id     INTEGER,
        disabled    INTEGER DEFAULT 0,
        not4sale    INTEGER DEFAULT 0,
        weight      DOUBLE PRECISION,
        stock_total DOUBLE PRECISION DEFAULT 0
    )""",
    "CREATE TABLE IF NOT EXISTS categories (cat_id INTEGER PRIMARY KEY, cat_desc TEXT)",
    "CREATE TABLE IF NOT EXISTS brands (brand_id INTEGER PRIMARY KEY, brand_desc TEXT)",
    "CREATE TABLE IF NOT EXISTS branches (bra_id INTEGER PRIMARY KEY, bra_desc TEXT)",
    "CREATE TABLE IF NOT EXISTS storages (stor_id INTEGER PRIMARY KEY, stor_name TEXT)",
    """CREATE TABLE IF NOT EXISTS stock (
        item_id INTEGER,
        stor_id INTEGER,
        fs      DOUBLE PRECISION DEFAULT 0,
        ps      DOUBLE PRECISION DEFAULT 0,
        PRIMARY KEY (item_id, stor_id)
    )""",
    "CREATE TABLE IF NOT EXISTS price_lists (prli_id INTEGER PRIMARY KEY, prli_desc TEXT)",
    """CREATE TABLE IF NOT EXISTS prices (
        prli_id INTEGER,
        item_id INTEGER,
        price   DOUBLE PRECISION,
        curr_id INTEGER,
        PRIMARY KEY (prli_id, item_id)
    )""",
    """CREATE TABLE IF NOT EXISTS ficha_miss (
        item_id    INTEGER PRIMARY KEY,
        checked_at TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS costs (
        item_id   INTEGER PRIMARY KEY,
        cost      DOUBLE PRECISION,   -- costo en ARS (convertido si venía en USD)
        cost_ppp  DOUBLE PRECISION,
        cost_curr TEXT,               -- moneda original en el ERP: ARS / USD
        cost_orig DOUBLE PRECISION    -- costo en su moneda original
    )""",
    """CREATE TABLE IF NOT EXISTS currencies (
        curr_id     INTEGER PRIMARY KEY,
        curr_desc   TEXT,
        curr_symbol TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS sgl_stock (
        sku   TEXT PRIMARY KEY,
        qty   DOUBLE PRECISION,
        descr TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS sales (
        fecha         TEXT,           -- yyyy-mm-dd
        sucursal      TEXT,
        vendedor      TEXT,
        cliente       TEXT,
        clase_cliente TEXT,
        comprobante   TEXT,
        condicion     TEXT,           -- condición de venta (define B2B/B2C)
        tipo          TEXT,           -- FC / NC
        item_code     TEXT,
        item_desc     TEXT,
        marca         TEXT,
        categoria     TEXT,
        subcategoria  TEXT,
        cantidad      DOUBLE PRECISION,
        total         DOUBLE PRECISION,  -- facturado con IVA, signo NC negativo
        neto          DOUBLE PRECISION,  -- sin IVA
        tc            DOUBLE PRECISION   -- tipo de cambio del comprobante
    )""",
    "CREATE INDEX IF NOT EXISTS idx_sales_fecha ON sales (fecha)",
    "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)",
    "CREATE INDEX IF NOT EXISTS idx_stock_stor ON stock (stor_id)",
    "CREATE INDEX IF NOT EXISTS idx_items_cat ON items (cat_id)",
    "CREATE INDEX IF NOT EXISTS idx_items_brand ON items (brand_id)",
    # Histórico de diferencias de stock trabajadas (GBP vs SGL). Congela la
    # foto del momento en que se empezó a trabajar el caso + comentario/estado.
    f"""CREATE TABLE IF NOT EXISTS historico_ajustes (
        id {'BIGSERIAL' if IS_PG else 'INTEGER'} PRIMARY KEY{'' if IS_PG else ' AUTOINCREMENT'},
        item_id     INTEGER,
        sku         TEXT,
        descripcion TEXT,
        gbp         DOUBLE PRECISION,
        sgl         DOUBLE PRECISION,
        diff        DOUBLE PRECISION,
        costo       DOUBLE PRECISION,
        valor_diff  DOUBLE PRECISION,
        areas       TEXT,               -- áreas del desvío (JSON de strings)
        comentario  TEXT,
        estado      TEXT DEFAULT 'en_proceso',
        created_at  TEXT,
        updated_at  TEXT
    )""",
    "CREATE INDEX IF NOT EXISTS idx_hist_estado ON historico_ajustes (estado)",
]

_schema_lock = threading.Lock()
_schema_ready = False


def _q(sql):
    """Traduce los placeholders estilo sqlite (?) a psycopg (%s)."""
    return sql.replace("?", "%s") if IS_PG else sql


class _PgCursor:
    def __init__(self, cur):
        self._cur = cur

    def execute(self, sql, params=()):
        self._cur.execute(_q(sql), params)
        return self

    def executemany(self, sql, seq):
        seq = list(seq)
        if seq:
            self._cur.executemany(_q(sql), seq)
        return self

    def __getattr__(self, name):
        return getattr(self._cur, name)

    def __iter__(self):
        return iter(self._cur)


class _PgConnection:
    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        return _PgCursor(self._conn.cursor()).execute(sql, params)

    def executemany(self, sql, seq):
        return _PgCursor(self._conn.cursor()).executemany(sql, seq)

    def cursor(self):
        return _PgCursor(self._conn.cursor())

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def _migrate(con):
    """Agrega columnas nuevas a tablas ya existentes (idempotente)."""
    nuevas = [("costs", "cost_curr", "TEXT"),
              ("costs", "cost_orig", "DOUBLE PRECISION"),
              ("sales", "condicion", "TEXT"),
              ("sales", "tc", "DOUBLE PRECISION"),
              ("historico_ajustes", "costo", "DOUBLE PRECISION"),
              ("historico_ajustes", "valor_diff", "DOUBLE PRECISION"),
              ("historico_ajustes", "areas", "TEXT")]
    if IS_PG:
        for tabla, col, tipo in nuevas:
            con.execute(f"ALTER TABLE {tabla} ADD COLUMN IF NOT EXISTS {col} {tipo}")
        con.commit()
    else:
        for tabla, col, tipo in nuevas:
            cols = [r[1] for r in con.execute(f"PRAGMA table_info({tabla})")]
            if col not in cols:
                con.execute(f"ALTER TABLE {tabla} ADD COLUMN {col} {tipo}")
        con.commit()


def _ensure_schema(con):
    global _schema_ready
    if _schema_ready:
        return
    with _schema_lock:
        if _schema_ready:
            return
        for stmt in SCHEMA:
            con.execute(stmt)
        con.commit()
        _migrate(con)
        _schema_ready = True


def connect():
    if IS_PG:
        import psycopg
        from psycopg.rows import dict_row
        # prepare_threshold=None: sin prepared statements. El transaction
        # pooler de Supabase (pgBouncer) reparte cada consulta a una conexión
        # distinta, y las prepared statements no sobreviven entre ellas.
        raw = psycopg.connect(config.DATABASE_URL, row_factory=dict_row,
                              connect_timeout=15, prepare_threshold=None)
        con = _PgConnection(raw)
    else:
        os.makedirs(os.path.dirname(config.DB_PATH), exist_ok=True)
        con = sqlite3.connect(config.DB_PATH, timeout=60)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA journal_mode=WAL")
    _ensure_schema(con)
    return con


def upsert(table, cols, conflict):
    """SQL de upsert portable. cols y conflict son tuplas de columnas."""
    ph = ",".join(["?"] * len(cols))
    collist = ",".join(cols)
    if IS_PG:
        updates = ",".join(f"{c}=EXCLUDED.{c}" for c in cols
                           if c not in conflict)
        return (f"INSERT INTO {table} ({collist}) VALUES ({ph}) "
                f"ON CONFLICT ({','.join(conflict)}) DO UPDATE SET {updates}")
    return f"INSERT OR REPLACE INTO {table} ({collist}) VALUES ({ph})"


def set_meta(con, key, value):
    con.execute(
        "INSERT INTO meta (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, json.dumps(value, ensure_ascii=False)),
    )
    con.commit()


def get_meta(con, key, default=None):
    row = con.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default
