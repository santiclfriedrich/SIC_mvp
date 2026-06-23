// Construye las filas de export (array-of-arrays) a partir de productos ya
// calculados (cada uno con `tiendas` de computeProduct). Dos modos:
//   - "pegar": precios finales redondeados por tienda (equivale a las columnas
//              JA–JN de la planilla, listo para copiar/pegar en otra Sheet).
//   - "full":  desglose precio + % de renta por tienda y modalidad.

const round = (n) => (n == null ? "" : Math.round(n));
const pct = (n) => (n == null ? "" : Number((n * 100).toFixed(2)));

/** Lista de tiendas activas en orden, desde la config. */
function tiendasActivas(config) {
  return Object.values(config.stores || {}).filter((s) => s.activo);
}

export function buildPegarRows(productos, config) {
  const stores = tiendasActivas(config);

  const headers = ["SKU", "Descripción"];
  for (const s of stores) {
    headers.push(`${s.nombre} 1 pago`);
    if (s.pagos["3csi"] && s.coefCSI) {
      headers.push(`${s.nombre} 3 CSI`, "CSI");
    }
  }

  const rows = productos.map((p) => {
    const row = [p.sku, p.descripcion || ""];
    for (const s of stores) {
      const fila = (p.tiendas || []).find((t) => t.storeKey === s.key);
      row.push(round(fila?.precio1Pago));
      if (s.pagos["3csi"] && s.coefCSI) {
        row.push(round(fila?.precio3CSI), 3);
      }
    }
    return row;
  });

  return { headers, rows };
}

export function buildFullRows(productos, config) {
  const stores = tiendasActivas(config);

  const headers = ["SKU", "Descripción", "Marca", "Costo s/IVA", "Peso aforado", "LP", "Stock"];
  for (const s of stores) {
    for (const pago of Object.keys(s.pagos)) {
      const etq = pago === "1pago" ? "1 pago" : "3 CSI";
      headers.push(`${s.nombre} ${etq} $`, `${s.nombre} ${etq} %`);
    }
  }

  const rows = productos.map((p) => {
    const row = [
      p.sku,
      p.descripcion || "",
      p.marca || "",
      p.costoSinIVA,
      p.pesoAforado,
      p.esLP ? "LP" : "",
      p.stock,
    ];
    for (const s of stores) {
      const fila = (p.tiendas || []).find((t) => t.storeKey === s.key);
      for (const pago of Object.keys(s.pagos)) {
        if (pago === "1pago") {
          row.push(round(fila?.precio1Pago), pct(fila?.renta1Pago));
        } else {
          row.push(round(fila?.precio3CSI), pct(fila?.renta3CSI));
        }
      }
    }
    return row;
  });

  return { headers, rows };
}

export function buildExportRows(productos, config, mode = "pegar") {
  return mode === "full"
    ? buildFullRows(productos, config)
    : buildPegarRows(productos, config);
}
