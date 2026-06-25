// Configuración por defecto del módulo de pricing, sembrada desde la planilla
// real ("precios-a-setear"). Todo esto es editable desde la UI (se persiste en
// PricingConfig.configJson); si no hay fila en DB, se usan estos defaults.
//
// Las tasas de cada tienda salen de la fila 8 de la planilla; los coeficientes
// CSI y las tablas de fee fueron verificados contra el archivo (los coef de
// Frávega/Megatone coinciden al dígito con los de la planilla).

// --- Tablas de fee por peso (c/IVA), tal cual la planilla ---
// Frávega y OnCity traen además la columna `feeConIVA30mil` (regla -30mil).
// `feeConIVA`: fee normal por tramo de peso. `feeConIVA30mil`: fee cuando el
// PRECIO del producto es < $30.000 (Frávega/OnCity = columna barata de la
// imagen; Megatone = 0, no cobra fee logístico por debajo de $30.000).
export const DEFAULT_FEE_TABLES = {
  fravega: [
    { desdeKg: 0, hastaKg: 1.5, feeConIVA: 5219, feeConIVA30mil: 1229 },
    { desdeKg: 1.51, hastaKg: 5, feeConIVA: 6669, feeConIVA30mil: 3334.5 },
    { desdeKg: 5.01, hastaKg: 15, feeConIVA: 8209, feeConIVA30mil: 4104.5 },
    { desdeKg: 15.01, hastaKg: 20, feeConIVA: 11159, feeConIVA30mil: 5579.5 },
    { desdeKg: 20.01, hastaKg: 25, feeConIVA: 15989, feeConIVA30mil: 7994.5 },
    { desdeKg: 25.01, hastaKg: 35, feeConIVA: 17719, feeConIVA30mil: 8859.5 },
    { desdeKg: 35.01, hastaKg: 50, feeConIVA: 23969, feeConIVA30mil: 11984.5 },
    { desdeKg: 50.01, hastaKg: 81, feeConIVA: 27969, feeConIVA30mil: 13984.5 },
    { desdeKg: 81.01, hastaKg: 100, feeConIVA: 39949, feeConIVA30mil: 19974.5 },
    { desdeKg: 100.01, hastaKg: 250, feeConIVA: 46599, feeConIVA30mil: 23299.5 },
    { desdeKg: 250.01, hastaKg: 500, feeConIVA: 86529, feeConIVA30mil: 43264.5 },
  ],
  // Megatone: fee CONSTANTE por peso (promedio general, sin regla <$30.000).
  megatone: [
    { desdeKg: 0, hastaKg: 2, feeConIVA: 4003 },
    { desdeKg: 2, hastaKg: 10, feeConIVA: 7886 },
    { desdeKg: 10, hastaKg: 30, feeConIVA: 12627 },
    { desdeKg: 30, hastaKg: 75, feeConIVA: 17929 },
    { desdeKg: 75, hastaKg: 200, feeConIVA: 32108 },
    { desdeKg: 200, hastaKg: 500, feeConIVA: 46705 },
  ],
  oncity: [
    { desdeKg: 0, hastaKg: 1.5, feeConIVA: 5845.28, feeConIVA30mil: 2609.5 },
    { desdeKg: 1.51, hastaKg: 5, feeConIVA: 7469.28, feeConIVA30mil: 3334.5 },
    { desdeKg: 5.01, hastaKg: 10, feeConIVA: 9194.08, feeConIVA30mil: 4104.5 },
    { desdeKg: 10.01, hastaKg: 15, feeConIVA: 9194.08, feeConIVA30mil: 4104.5 },
    { desdeKg: 15.01, hastaKg: 20, feeConIVA: 12498.08, feeConIVA30mil: 5579.5 },
    { desdeKg: 20.01, hastaKg: 25, feeConIVA: 17907.68, feeConIVA30mil: 7994.5 },
    { desdeKg: 25.01, hastaKg: 35, feeConIVA: 19845.28, feeConIVA30mil: 8859.5 },
    { desdeKg: 35.01, hastaKg: 50, feeConIVA: 26845.28, feeConIVA30mil: 11984.5 },
    { desdeKg: 50.01, hastaKg: 81, feeConIVA: 31325.28, feeConIVA30mil: 13984.5 },
    { desdeKg: 81.01, hastaKg: 100, feeConIVA: 44742.88, feeConIVA30mil: 19974.5 },
    { desdeKg: 100.01, hastaKg: 250, feeConIVA: 52190.88, feeConIVA30mil: 23299.5 },
    { desdeKg: 250.01, hastaKg: 500, feeConIVA: 96912.48, feeConIVA30mil: 43264.5 },
  ],
};

// --- Tiendas activas (orden de aparición en la UI / export) ---
// `pagos`: cada modalidad con su comisión y comisión CSI (fila 8 de la planilla).
// `coefCSI`: para derivar el precio de 3 CSI a partir del de 1 pago.
// `feeTabla`: clave en DEFAULT_FEE_TABLES (null = sin fee, ej. ICBC).
// `logistica`: % de logística de la tienda (OnCity 2,8%, el resto 3%).
//   El fee de cada SKU sale del lookup por peso, salvo que el SKU traiga un fee
//   manual importado de la planilla (NO se aplica ninguna regla "-30mil" auto).
export const DEFAULT_STORES = {
  icbc: {
    key: "icbc",
    nombre: "ICBC",
    activo: true,
    feeTabla: null,
    logistica: 0.03,
    coefCSI: null,
    pagos: {
      "1pago": { comision: 0.13, csi: 0 },
    },
  },
  fravega: {
    key: "fravega",
    nombre: "Frávega",
    activo: true,
    feeTabla: "fravega",
    logistica: 0.03,
    aplicaRegla30mil: true,
    coefCSI: 1.12315828,
    pagos: {
      "1pago": { comision: 0.15, csi: 0 },
      "3csi": { comision: 0.15, csi: 0.07 },
    },
  },
  megatone: {
    key: "megatone",
    nombre: "Megatone",
    activo: true,
    feeTabla: "megatone",
    logistica: 0.03,
    aplicaRegla30mil: false,
    coefCSI: 1.08497992,
    pagos: {
      "1pago": { comision: 0.15, csi: 0 },
      "3csi": { comision: 0.13, csi: 0.07 },
    },
  },
  oncity: {
    key: "oncity",
    nombre: "On City",
    activo: true,
    feeTabla: "oncity",
    logistica: 0.028,
    aplicaRegla30mil: true,
    coefCSI: 1.17912364,
    pagos: {
      "1pago": { comision: 0.14, csi: 0 },
      "3csi": { comision: 0.14, csi: 0.0968 },
    },
  },
};

export const DEFAULT_CONFIG = {
  stores: DEFAULT_STORES,
  feeTables: DEFAULT_FEE_TABLES,
};

// --- Mapeo de columnas del report21 (export crudo del ERP) ---
// Se busca por nombre de header (case/acentos-insensitive); como el header de
// stock incluye una fecha variable ("Stock 17/06"), se matchea por prefijo.
export const REPORT21_MAP = {
  sku: ["sku"],
  costoSinIVA: ["costo zentor"],
  pesoAforado: ["aforo"],
  stockValorizado: ["stock valorizado"],
  descripcion: ["descripcion"],
  marca: ["marca"],
  ivaCoef: ["iva_coef", "coef iva"],
  // stock: header tipo "Stock 17/06" → se resuelve por prefijo "stock " que NO
  // sea "stock valorizado".
  stockPrefijo: "stock ",
};

/** Marca un SKU como LP si la descripción trae el tag [LP...] (ej. [LP1]). */
export function detectarLP(descripcion = "") {
  return /\[lp\d*\]/i.test(String(descripcion));
}

// --- Mapeo de la hoja principal de la planilla ("AJUSTE formula cobramos-ganamo") ---
// Permite IMPORTAR los precios ya seteados (columnas PRECIO-* de 1 pago) además
// de los datos base. Labels en minúscula/sin acentos (se matchea normalizado).
export const PLANILLA_MAP = {
  sku: ["sku"],
  costoSinIVA: ["costo s/iva"],
  pesoAforado: ["peso aforado"],
  descripcion: ["descripcion"],
  marca: ["marca"],
  stock: ["stock3-6", "stock"],
  stockValorizado: ["stock valorizado al 14-5", "stock valorizado"],
  ivaCoef: ["coef iva"],
  iibLP: ["iib lp"],
  ingresosBrutos: ["ingresos brutos %"],
  // Columna del precio de 1 pago por tienda (header de la fila 9).
  precioCols: {
    icbc: ["precio-icbc"],
    fravega: ["precio-fravega-1pago"],
    megatone: ["precio-megatone- 1pago", "precio-megatone-1pago"],
    oncity: ["on city 1 pago"],
  },
  // Columna de fee manual por tienda (la planilla las ajusta a mano).
  feeCols: {
    fravega: ["fee fravega"],
    megatone: ["fee megatone"],
    oncity: ["fee on city"],
  },
};

// Columnas de la hoja principal donde la PLANILLA VIVA recibe los precios de la
// web (1 pago y 3 CSI por tienda) + IIB LP / Ingresos brutos (para el LP).
// Se detectan por label al crear la planilla viva (no se hardcodean letras).
export const PLANILLA_COLS = {
  precios: {
    icbc: { "1pago": ["precio-icbc"] },
    fravega: { "1pago": ["precio-fravega-1pago"], "3csi": ["precio-fravega-3csi"] },
    megatone: {
      "1pago": ["precio-megatone- 1pago", "precio-megatone-1pago"],
      "3csi": ["precio-megatone- 3csi", "precio-megatone-3csi"],
    },
    oncity: { "1pago": ["on city 1 pago"], "3csi": ["on city 3csi"] },
  },
  iibLP: ["iib lp"],
  ingresosBrutos: ["ingresos brutos %"],
};
