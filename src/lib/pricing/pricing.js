// Núcleo de pricing para tiendas.
//
// Funciones PURAS, sin estado ni I/O — replican la lógica de la planilla Excel
// (ver el "mapa de fórmulas" del módulo). Todo lo que cambia entre tiendas/SKU
// entra por `params`; estas funciones no conocen tasas concretas.
//
// Relación clave: rentaPct es LINEAL en el precio P, por eso `calcInverse` despeja
// el precio exacto para un % objetivo y se cumple forward(inverse(t)).rentaPct ≈ t.

// --- Defaults globales ---
// OJO: el IVA es POR SKU (la planilla tiene una columna COEF IVA: 1,21 normal,
// pero 1,105 para productos con alícuota reducida). La logística es POR TIENDA
// (OnCity usa 2,8%, el resto 3%). Estos son sólo los valores por defecto.
export const IVA = 1.21;
export const LOGISTICA = 0.03; // 3%
export const PAYWAY = 0.028; // 2,8%

/**
 * Regla LP (un simple "swap"):
 *   LP    → iibLP = 5,5% / ingresosBrutos = 0%
 *   no-LP → iibLP = 0%   / ingresosBrutos = 5,5%
 */
export function lpRates(esLP) {
  return esLP
    ? { iibLP: 0.055, ingresosBrutos: 0 }
    : { iibLP: 0, ingresosBrutos: 0.055 };
}

/**
 * @typedef {Object} PricingParams
 * @property {number} costoSinIVA     Costo s/IVA del SKU (report21).
 * @property {number} comision        Comisión de la tienda (ej. 0.15).
 * @property {number} csi             Comisión cuotas s/interés (0 en 1 pago).
 * @property {number} iibLP           Dif. IIB LP (0.055 si LP, 0 si no).
 * @property {number} ingresosBrutos  Ingresos brutos (0 si LP, 0.055 si no).
 * @property {number} [fee]           Fee logístico c/IVA (0 para ICBC).
 * @property {number} [iva]           Coef. IVA del SKU (default 1.21).
 * @property {number} [logistica]     Logística de la tienda (default 0.03).
 * @property {number} [payway]        Pay way (default 0.028).
 */

/**
 * Cálculo forward: dado un precio final `precio`, devuelve el desglose completo
 * y el % de renta resultante.
 * @param {number} precio
 * @param {PricingParams} params
 */
export function calcForward(precio, params) {
  const {
    costoSinIVA,
    comision,
    csi = 0,
    iibLP,
    ingresosBrutos,
    fee = 0,
    iva = IVA,
    logistica = LOGISTICA,
    payway = PAYWAY,
  } = params;

  const sIVA = precio / iva;
  const comisionD = precio * comision;
  const comisionCSI = precio * csi;
  const iib = sIVA * ingresosBrutos;
  const difIIB = (sIVA - costoSinIVA) * iibLP;
  const logist = precio * logistica;
  const pw = precio * payway;

  const cobramos =
    precio - comisionD - comisionCSI - iib - difIIB - logist - pw - fee;
  const ganamos = cobramos / iva - costoSinIVA;
  const rentaPct = sIVA === 0 ? 0 : ganamos / sIVA;

  return {
    precio,
    sIVA,
    comisionD,
    comisionCSI,
    iib,
    difIIB,
    logist,
    pw,
    fee,
    cobramos,
    ganamos,
    rentaPct,
  };
}

/**
 * Cálculo inverso: dado un % de renta objetivo, despeja el precio exacto.
 *
 *   K = 1 − comisión − csi − logística − payway − (ingresosBrutos + iibLP)/iva
 *   precio = ( costoSinIVA·(iibLP − iva) − fee ) / ( objetivo − K )
 *
 * @param {number} objetivo  Renta objetivo como fracción (ej. 0.045 = 4,5%).
 * @param {PricingParams} params
 */
export function calcInverse(objetivo, params) {
  const {
    costoSinIVA,
    comision,
    csi = 0,
    iibLP,
    ingresosBrutos,
    fee = 0,
    iva = IVA,
    logistica = LOGISTICA,
    payway = PAYWAY,
  } = params;

  const K =
    1 - comision - csi - logistica - payway - (ingresosBrutos + iibLP) / iva;

  return (costoSinIVA * (iibLP - iva) - fee) / (objetivo - K);
}

/**
 * Fee logístico por peso aforado (KG). Replica el INDEX/MATCH aproximado de la
 * planilla: con la tabla ordenada ascendente por `desdeKg`, devuelve el ÚLTIMO
 * tramo cuyo `desdeKg` es <= peso (así un peso que cae en un "hueco" entre
 * tramos —ej. 1,5 entre 0–1,5 y 1,51–5— toma el tramo anterior, igual que Excel).
 *
 * Regla "-30mil": en tiendas que la aplican (Frávega / OnCity), si el precio del
 * producto es < $30.000 se usa la columna `feeConIVA30mil` del tramo (la planilla
 * tiene esos valores explícitos; si no estuviera, cae a la mitad del fee).
 *
 * @param {number} pesoKg
 * @param {Array<{desdeKg:number, hastaKg:number, feeConIVA:number, feeConIVA30mil?:number}>} tramos
 * @param {Object} [opts]
 * @param {number} [opts.precio]        Precio del producto (para la regla -30mil).
 * @param {boolean} [opts.aplicaRegla30mil=false]
 * @returns {number} fee c/IVA (0 si no hay tabla o el peso es menor al primer tramo).
 */
export function feePorPeso(pesoKg, tramos, opts = {}) {
  if (!Array.isArray(tramos) || tramos.length === 0) return 0;
  const { precio, aplicaRegla30mil = false } = opts;

  let tramo = null;
  for (const t of tramos) {
    if (pesoKg >= t.desdeKg) tramo = t;
    else break;
  }
  if (!tramo) return 0; // peso menor al primer tramo de la tabla

  const usar30mil =
    aplicaRegla30mil && precio != null && precio < 30000;
  if (usar30mil) {
    return tramo.feeConIVA30mil != null
      ? tramo.feeConIVA30mil
      : tramo.feeConIVA / 2;
  }
  return tramo.feeConIVA;
}

/**
 * Precio de 3 cuotas sin interés derivado del de 1 pago:
 *   precio3CSI = precio1Pago × coefCSI
 * @param {number} precio1Pago
 * @param {number} coefCSI
 */
export function precio3CSI(precio1Pago, coefCSI) {
  return precio1Pago * coefCSI;
}
