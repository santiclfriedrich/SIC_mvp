// Parser + cruce de la conciliación GBP ↔ MercadoPago.
//
// Entrada: un .xlsx con 4 hojas
//   - "gbp"    : nuestro listado (recibos del ERP). Clave: "Nro_Operacion_Limpio".
//   - "argcol" / "kanji" / "ganga" : cobros de 3 cuentas de MercadoPago.
//        Clave: "Operación Relacionada".
//
// El cruce parte del listado GBP y arma 3 grupos:
//   - cobradas   : op de GBP que aparece en alguna cuenta MP.
//   - pendientes : op de GBP sin cobro en MP.
//   - sobrantes  : cobro de MP cuya operación no está en GBP.

export const CUENTAS_MP = ["argcol", "kanji", "ganga"];

// ---- Helpers de normalización ----

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Normaliza un header para matchear columnas sin importar acentos/espacios/mayúsculas. */
export function normHdr(s) {
  return stripAccents(String(s ?? "").trim().toLowerCase()).replace(/[\s_]+/g, "");
}

/** Busca el índice de la primera columna que matchee alguno de los nombres candidatos. */
export function findCol(headers, candidatos) {
  const H = (headers || []).map(normHdr);
  for (const c of candidatos) {
    const i = H.indexOf(normHdr(c));
    if (i >= 0) return i;
  }
  return -1;
}

/** Normaliza un N° de operación: deja solo dígitos (evita líos de tipo/formato). */
export function normOp(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(Math.round(v));
  return String(v).trim().replace(/\D/g, "");
}

/** Convierte a número tolerando strings con símbolos y formato ES. */
export function aNumero(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\$/g, "").replace(/\s/g, "");
  if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.indexOf(",") >= 0) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

const aTexto = (v) => (v === null || v === undefined ? "" : String(v).trim());

/** "16/06/2026" -> Date (local). Devuelve "" si no parsea. */
function fechaDMY(v) {
  const s = aTexto(v);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  return new Date(year, Number(mo) - 1, Number(d));
}

/** ISO "2026-06-01T00:02:06Z" -> Date. Devuelve "" si no parsea. */
function fechaISO(v) {
  const s = aTexto(v);
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d;
}

// ---- Parseo de cada hoja ----

/** Agrupa las filas de GBP por N° de operación (una op = un recibo, normalmente). */
function parsearGbp(rows) {
  if (!rows || rows.length === 0) return { ops: new Map(), sinOp: 0 };
  const h = rows[0];
  const cOp = findCol(h, ["Nro_Operacion_Limpio"]);
  const cCliente = findCol(h, ["Cliente"]);
  const cRecibo = findCol(h, ["Recibo"]);
  const cFecha = findCol(h, ["Fecha_Mov", "Fecha Mov"]);
  const cImporte = findCol(h, ["Importe_Ingresa", "Importe Ingresa"]);
  const cSucursal = findCol(h, ["Sucursal"]);
  const cVendedor = findCol(h, ["Vendedor"]);

  const ops = new Map();
  let sinOp = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const op = normOp(r[cOp]);
    if (!op) {
      sinOp++;
      continue;
    }
    const importe = aNumero(r[cImporte]);
    if (!ops.has(op)) {
      ops.set(op, {
        op,
        cliente: aTexto(r[cCliente]),
        recibo: aTexto(r[cRecibo]),
        fecha: fechaDMY(r[cFecha]),
        sucursal: aTexto(r[cSucursal]),
        vendedor: aTexto(r[cVendedor]),
        importe: 0,
        filas: 0,
      });
    }
    const e = ops.get(op);
    e.importe += importe;
    e.filas += 1;
  }
  return { ops, sinOp };
}

/** Agrupa los movimientos de una cuenta MP por "Operación Relacionada". */
function parsearMp(rows, cuenta, acc) {
  if (!rows || rows.length === 0) return;
  const h = rows[0];
  const cOp = findCol(h, ["Operación Relacionada", "Operacion Relacionada"]);
  const cFecha = findCol(h, ["Fecha de Pago", "Fecha Pago"]);
  const cImporte = findCol(h, ["Importe"]);
  const cTipo = findCol(h, ["Tipo de Operación", "Tipo de Operacion"]);
  const cConcepto = findCol(h, ["concepto", "Concepto"]);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const op = normOp(r[cOp]);
    if (!op) continue;
    const importe = aNumero(r[cImporte]);
    const fecha = fechaISO(r[cFecha]);
    if (!acc.has(op)) {
      acc.set(op, {
        op,
        cuentas: new Set(),
        importe: 0,
        movimientos: 0,
        fecha: "",
        concepto: aTexto(r[cConcepto]),
        tipos: new Set(),
      });
    }
    const e = acc.get(op);
    e.cuentas.add(cuenta);
    e.importe += importe;
    e.movimientos += 1;
    if (fecha && (!e.fecha || fecha < e.fecha)) e.fecha = fecha; // primer pago
    if (r[cTipo]) e.tipos.add(aTexto(r[cTipo]));
  }
}

/**
 * Cruza las 4 hojas y devuelve los 3 grupos + totales.
 * @param {Object} matrices  { gbp: rows, argcol: rows, kanji: rows, ganga: rows }
 *   (rows = matriz [fila][col], la fila 0 son los headers)
 */
export function cruzar(matrices) {
  const { ops: gbpOps, sinOp } = parsearGbp(matrices.gbp);

  const mpOps = new Map();
  for (const cuenta of CUENTAS_MP) {
    parsearMp(matrices[cuenta], cuenta, mpOps);
  }

  const cobradas = [];
  const pendientes = [];

  for (const g of gbpOps.values()) {
    const mp = mpOps.get(g.op);
    if (mp) {
      cobradas.push({
        op: g.op,
        cliente: g.cliente,
        recibo: g.recibo,
        fecha: g.fecha,
        importeGbp: g.importe,
        cuentaMp: [...mp.cuentas].join(", "),
        importeMp: mp.importe,
        diferencia: g.importe - mp.importe,
      });
    } else {
      pendientes.push({
        op: g.op,
        cliente: g.cliente,
        recibo: g.recibo,
        fecha: g.fecha,
        importeGbp: g.importe,
      });
    }
  }

  const sobrantes = [];
  for (const mp of mpOps.values()) {
    if (!gbpOps.has(mp.op)) {
      sobrantes.push({
        op: mp.op,
        cuentaMp: [...mp.cuentas].join(", "),
        fecha: mp.fecha,
        importeMp: mp.importe,
        concepto: mp.concepto,
        tipo: [...mp.tipos].join(", "),
      });
    }
  }

  // Orden: por importe desc (lo más relevante arriba).
  cobradas.sort((a, b) => b.importeGbp - a.importeGbp);
  pendientes.sort((a, b) => b.importeGbp - a.importeGbp);
  sobrantes.sort((a, b) => b.importeMp - a.importeMp);

  const sum = (arr, k) => arr.reduce((acc, x) => acc + (x[k] || 0), 0);

  const totales = {
    gbpOps: gbpOps.size,
    gbpSinOp: sinOp,
    mpOps: mpOps.size,
    cobradas: cobradas.length,
    pendientes: pendientes.length,
    sobrantes: sobrantes.length,
    montoCobrado: sum(cobradas, "importeMp"),
    montoPendiente: sum(pendientes, "importeGbp"),
    montoSobrante: sum(sobrantes, "importeMp"),
  };

  return { cobradas, pendientes, sobrantes, totales };
}
