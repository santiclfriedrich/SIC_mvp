// Capa que une la config de tiendas con el SKU y produce precios/renta listos
// para la UI y el export. Se apoya en las primitivas puras de pricing.js.

import { calcForward, calcInverse, feePorPeso, lpRates, precio3CSI } from "./pricing.js";
import { DEFAULT_CONFIG } from "./stores.js";

/** Devuelve la tabla de tramos de fee de una tienda (o null si no tiene). */
export function feeTablaDe(storeCfg, config = DEFAULT_CONFIG) {
  if (!storeCfg.feeTabla) return null;
  return config.feeTables?.[storeCfg.feeTabla] ?? null;
}

/**
 * Resuelve el fee c/IVA de una tienda para un producto a un precio dado.
 *   1) Si el SKU trae un fee manual importado (producto.fees[storeKey]) → ese
 *      (preserva exactamente lo que tenía la planilla histórica).
 *   2) Si no, lookup por peso + REGLA < $30.000: si el precio del producto es
 *      menor a $30.000, Frávega/OnCity usan la columna barata y Megatone cobra 0.
 */
export function resolveFee(storeCfg, producto, precio, config = DEFAULT_CONFIG) {
  const override = producto.fees?.[storeCfg.key];
  if (override != null && Number.isFinite(Number(override))) {
    return Number(override);
  }
  const tramos = feeTablaDe(storeCfg, config);
  if (!tramos) return 0;
  return feePorPeso(Number(producto.pesoAforado) || 0, tramos, {
    precio,
    aplicaRegla30mil: !!storeCfg.aplicaRegla30mil,
  });
}

/**
 * Arma los PricingParams de una tienda+modalidad para un SKU.
 * @param {object} storeCfg tienda (para logística)
 * @param {object} pagoCfg  { comision, csi }
 * @param {object} producto { costoSinIVA, esLP, ivaCoef }
 * @param {number} fee      fee c/IVA ya resuelto
 */
export function paramsFor(storeCfg, pagoCfg, producto, fee) {
  return {
    costoSinIVA: Number(producto.costoSinIVA) || 0,
    comision: pagoCfg.comision,
    csi: pagoCfg.csi || 0,
    fee: fee || 0,
    iva: Number(producto.ivaCoef) > 0 ? Number(producto.ivaCoef) : 1.21,
    logistica: storeCfg.logistica != null ? storeCfg.logistica : 0.03,
    ...lpRates(!!producto.esLP),
  };
}

/**
 * Forward de una tienda+modalidad a un precio concreto.
 * @returns {{ fee:number } & ReturnType<typeof calcForward>}
 */
export function forwardStore(storeCfg, pago, producto, precio, config = DEFAULT_CONFIG) {
  const pagoCfg = storeCfg.pagos[pago];
  const fee = resolveFee(storeCfg, producto, precio, config);
  const params = paramsFor(storeCfg, pagoCfg, producto, fee);
  return { fee, ...calcForward(precio, params) };
}

/**
 * Inverso: precio que alcanza un % objetivo. Como el fee de la regla < $30.000
 * depende del precio resultante, se resuelve en dos pasadas.
 */
export function inverseStore(storeCfg, pago, producto, objetivo, config = DEFAULT_CONFIG) {
  const pagoCfg = storeCfg.pagos[pago];

  const feeFull = resolveFee(storeCfg, producto, Infinity, config); // fuerza fee normal
  let precio = calcInverse(objetivo, paramsFor(storeCfg, pagoCfg, producto, feeFull));

  if (storeCfg.aplicaRegla30mil && precio < 30000) {
    const fee30 = resolveFee(storeCfg, producto, 0, config); // fuerza fee < $30.000
    const precio30 = calcInverse(objetivo, paramsFor(storeCfg, pagoCfg, producto, fee30));
    if (precio30 < 30000) precio = precio30;
  }
  return precio;
}

/**
 * Calcula, para un producto y su precio de 1 pago seteado por tienda, el detalle
 * de todas las tiendas activas: precio + renta de 1 pago y de 3 CSI (derivado).
 *
 * @param {object} producto { costoSinIVA, pesoAforado, esLP, precios:{[key]:number} }
 * @param {object} config
 * @returns {Array} filas por tienda
 */
export function computeProduct(producto, config = DEFAULT_CONFIG) {
  const stores = config.stores || {};
  const precios = producto.precios || {};
  const precios3 = producto.precios3 || {}; // overrides de 3 CSI (independientes)
  const filas = [];

  for (const key of Object.keys(stores)) {
    const storeCfg = stores[key];
    if (!storeCfg.activo) continue;

    const precio1 = Number(precios[key]) || 0;
    const override3 = precios3[key] != null ? Number(precios3[key]) : null;
    const fila = {
      storeKey: key,
      nombre: storeCfg.nombre,
      precio1Pago: precio1 || null,
      renta1Pago: null,
      precio3CSI: null,
      renta3CSI: null,
      tres3csiIndependiente: false, // true si el 3CSI fue editado a mano
    };

    if (precio1 > 0 && storeCfg.pagos["1pago"]) {
      fila.renta1Pago = forwardStore(storeCfg, "1pago", producto, precio1, config).rentaPct;
    }

    // 3 CSI: override editado a mano si existe; si no, derivado del 1 pago × coef.
    if (storeCfg.pagos["3csi"] && storeCfg.coefCSI) {
      let p3 = null;
      if (override3 != null && override3 > 0) {
        p3 = override3;
        fila.tres3csiIndependiente = true;
      } else if (precio1 > 0) {
        p3 = precio3CSI(precio1, storeCfg.coefCSI);
      }
      if (p3 != null) {
        fila.precio3CSI = p3;
        fila.renta3CSI = forwardStore(storeCfg, "3csi", producto, p3, config).rentaPct;
      }
    }

    filas.push(fila);
  }
  return filas;
}

/** Genera un % objetivo aleatorio en [min, max] (default 4%–5%). */
export function rentaRandom(min = 0.04, max = 0.05, rnd = Math.random()) {
  return min + rnd * (max - min);
}
