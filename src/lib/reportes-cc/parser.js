// Parser literal del Apps Script "REPORTE DE CUENTAS CORRIENTES".
// Detecta bloques que empiezan con "Cuenta Nº" en col A, lee comprobantes,
// y cierra con la fila "Totales" que contiene el saldo total adeudado.

import { VENDEDORES_EXCLUIDOS, UMBRAL_SALDO } from "./config";

export function aTexto(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function aNumero(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v === "string") {
    let s = v.trim();
    if (s === "" || s.toLowerCase() === "nan") return null;
    let esNegativo = false;
    if (s.charAt(0) === "(" && s.charAt(s.length - 1) === ")") {
      esNegativo = true;
      s = s.substring(1, s.length - 1);
    }
    s = s.replace(/\$/g, "").replace(/\s/g, "");
    if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) {
      // Formato ES: "1.234,56" → "1234.56"
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.indexOf(",") >= 0 && s.indexOf(".") < 0) {
      s = s.replace(",", ".");
    }
    const n = parseFloat(s);
    if (!isNaN(n)) return esNegativo ? -n : n;
  }
  return null;
}

export function vendedoresStr(cliente) {
  const set = {};
  for (let i = 0; i < cliente.comprobantes.length; i++) {
    const v = cliente.comprobantes[i].vendedor;
    if (v && v !== "nan") set[v] = true;
  }
  return Object.keys(set).sort().join(", ");
}

/**
 * datos: matriz [filas][cols] — equivalente al getDataRange().getValues() del Script.
 * Las fechas deben venir como Date (con xlsx usar { cellDates: true }).
 */
export function parsearClientes(datos) {
  const clientes = [];
  let cliente = null;

  for (let i = 0; i < datos.length; i++) {
    const row = datos[i] || [];
    const c0 = aTexto(row[0]);

    if (c0 === "Cuenta Nº") {
      if (cliente) clientes.push(cliente);
      cliente = {
        numero: row[1],
        nombre: row[3],
        comprobantes: [],
        saldo_total: null,
      };
      continue;
    }

    if (c0 === "Totales" && cliente) {
      if (cliente.saldo_total === null) {
        const n = aNumero(row[1]);
        if (n !== null) cliente.saldo_total = n;
      }
      continue;
    }

    if (c0.indexOf("Impreso") === 0) continue;
    if (!cliente) continue;

    const comprobante = aTexto(row[3]);
    const total = aNumero(row[5]);
    if (comprobante !== "" && total !== null) {
      const saldo = aNumero(row[6]);
      cliente.comprobantes.push({
        vendedor: aTexto(row[0]),
        fecha: row[2] instanceof Date ? row[2] : "",
        comprobante: comprobante,
        fecha_pago: row[4] instanceof Date ? row[4] : "",
        total: total,
        saldo: saldo !== null ? saldo : 0,
      });
    }
  }

  if (cliente) clientes.push(cliente);
  return clientes;
}

/**
 * Aplica los mismos filtros que el Apps Script:
 *  - excluye vendedores en VENDEDORES_EXCLUIDOS
 *  - excluye clientes con saldo_total <= UMBRAL_SALDO
 *  - ordena por saldo_total desc
 */
export function filtrarYOrdenar(clientes) {
  const conVendedor = clientes.map((c) => ({
    ...c,
    vendedoresStr: vendedoresStr(c),
  }));

  const filtrados = conVendedor.filter((c) => {
    if (VENDEDORES_EXCLUIDOS.indexOf(c.vendedoresStr) !== -1) return false;
    if ((c.saldo_total || 0) <= UMBRAL_SALDO) return false;
    return true;
  });

  filtrados.sort((a, b) => (b.saldo_total || 0) - (a.saldo_total || 0));

  return {
    clientes: filtrados,
    excluidos: clientes.length - filtrados.length,
    totalOriginal: clientes.length,
  };
}

/**
 * Calcula totales agregados para el dashboard.
 */
export function calcularTotales(clientes) {
  let totalDeuda = 0;
  let totalComp = 0;
  let sinComp = 0;

  for (const c of clientes) {
    totalDeuda += c.saldo_total || 0;
    totalComp += c.comprobantes.length;
    if (c.comprobantes.length === 0) sinComp++;
  }

  return {
    totalDeuda,
    totalComp,
    totalClientes: clientes.length,
    sinComp,
    promedio: clientes.length > 0 ? totalDeuda / clientes.length : 0,
  };
}

/**
 * Agrupa la deuda por vendedor (para el gráfico de torta del dashboard).
 */
export function deudaPorVendedor(clientes) {
  const acc = {};
  for (const c of clientes) {
    const v = c.vendedoresStr || "— Sin vendedor —";
    acc[v] = (acc[v] || 0) + (c.saldo_total || 0);
  }
  return Object.entries(acc)
    .map(([vendedor, saldo]) => ({ vendedor, saldo }))
    .sort((a, b) => b.saldo - a.saldo);
}
