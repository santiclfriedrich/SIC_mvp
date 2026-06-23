// Regresión contra la planilla real ("precios-a-setear-4-6").
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  forwardStore,
  inverseStore,
  resolveFee,
  computeProduct,
} from "./engine.js";
import { DEFAULT_STORES, DEFAULT_CONFIG } from "./stores.js";
import { parseReport21 } from "./report21.js";

const approx = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `esperado ≈ ${b}, obtuve ${a}`);

// Fixtures verificados celda por celda (incluye AIOKAN0006 con IVA 1,105 y fees
// manuales que NO coinciden con el lookup por peso).
const FIXTURES = [
  {
    sku: "MONKAN0034", costo: 146050.4132, peso: 18.8, iva: 1.21, lp: true,
    fees: { fravega: 11159, megatone: 12627.333333333334, oncity: 12498.08 },
    precios: { icbc: 256219.334477773, fravega: 281726.91906199686, megatone: 284027.0326420943, oncity: 278587.7375432893 },
    pct: { icbc: 0.1081711457, fravega: 0.1081711457, megatone: 0.108171146, oncity: 0.1081711457 },
  },
  {
    sku: "AIOKAN0006", costo: 578733.0317, peso: 11.4, iva: 1.105, lp: true,
    fees: { fravega: 8209, megatone: 12627.3333333333, oncity: 9194.08 },
    precios: { icbc: 853197.540472408, fravega: 889707.2141610046, megatone: 896090.0021205756, oncity: 875945.4341276918 },
    pct: { icbc: 0.04999999607, fravega: 0.05000000016, megatone: 0.05000000016, oncity: 0.05000000005 },
  },
  {
    sku: "LVVCAN0002", costo: 374511.8, peso: 54.8, iva: 1.21, lp: false,
    fees: { fravega: 27969, megatone: 32108, oncity: 31325.28 },
    precios: { icbc: 632422.235147976, fravega: 690734.9331904138, megatone: 696677.1154334228, oncity: 683773.4333314821 },
    pct: { icbc: 0.04999999992, fravega: 0.05000000001, megatone: 0.05000000006, oncity: 0.05000000018 },
  },
  {
    sku: "VENKAN0004", costo: 20045.95, peso: 5.2, iva: 1.21, lp: true,
    fees: { fravega: 8209, megatone: 7886, oncity: 4104.5 },
    precios: { icbc: 32312.0774885532, fravega: 45025.16245102955, megatone: 44561.44541384683, oncity: 38469.758123990585 },
    pct: { icbc: 0.05000000004, fravega: 0.0499999999, megatone: 0.05000000002, oncity: 0.05000000016 },
  },
];

function productoDe(f) {
  return {
    sku: f.sku, costoSinIVA: f.costo, pesoAforado: f.peso, esLP: f.lp,
    ivaCoef: f.iva, fees: f.fees, precios: f.precios,
  };
}

test("forwardStore reproduce la renta de la planilla (IVA por SKU + logística + fee manual)", () => {
  for (const f of FIXTURES) {
    const prod = productoDe(f);
    for (const key of Object.keys(f.precios)) {
      const r = forwardStore(DEFAULT_STORES[key], "1pago", prod, f.precios[key]);
      approx(r.rentaPct, f.pct[key], 1e-7);
    }
  }
});

test("resolveFee: override del SKU gana; si no, regla por peso + < $30.000", () => {
  // Override manual gana sin importar el precio.
  const prod = productoDe(FIXTURES[3]); // fees.oncity = 4104.5
  approx(resolveFee(DEFAULT_STORES.oncity, prod, 999999, DEFAULT_CONFIG), 4104.5);

  // Sin override, precio ≥ $30.000 → fee normal por peso (Frávega 18,8kg → 11159).
  const sinFee = { pesoAforado: 18.8 };
  approx(resolveFee(DEFAULT_STORES.fravega, sinFee, 50000, DEFAULT_CONFIG), 11159);
  approx(resolveFee(DEFAULT_STORES.icbc, sinFee, 50000, DEFAULT_CONFIG), 0);

  // Regla < $30.000: Frávega columna barata, Megatone 0.
  approx(resolveFee(DEFAULT_STORES.fravega, sinFee, 25000, DEFAULT_CONFIG), 5579);
  approx(resolveFee(DEFAULT_STORES.megatone, sinFee, 25000, DEFAULT_CONFIG), 0);
  approx(resolveFee(DEFAULT_STORES.megatone, sinFee, 50000, DEFAULT_CONFIG), 12627.333333333334);
  // OnCity 5,2kg < $30.000 → columna barata del tramo [5.01,15] = 4104.5
  approx(resolveFee(DEFAULT_STORES.oncity, { pesoAforado: 5.2 }, 25000, DEFAULT_CONFIG), 4104.5);
});

test("forward(inverse(t)) ≈ t con IVA 1,105 y fee manual", () => {
  const prod = productoDe(FIXTURES[1]); // AIOKAN0006, iva 1.105
  for (const key of ["icbc", "fravega", "megatone", "oncity"]) {
    for (const t of [0.04, 0.045, 0.05]) {
      const P = inverseStore(DEFAULT_STORES[key], "1pago", prod, t);
      const r = forwardStore(DEFAULT_STORES[key], "1pago", prod, P);
      approx(r.rentaPct, t, 1e-9);
    }
  }
});

test("computeProduct: deriva 3CSI por coeficiente y calcula su renta", () => {
  const prod = productoDe(FIXTURES[0]);
  const filas = computeProduct(prod, DEFAULT_CONFIG);
  const fravega = filas.find((f) => f.storeKey === "fravega");
  approx(fravega.precio3CSI, FIXTURES[0].precios.fravega * 1.12315828);
  assert.equal(fravega.tres3csiIndependiente, false);
  assert.ok(fravega.renta1Pago > 0 && fravega.renta3CSI > 0);
  const icbc = filas.find((f) => f.storeKey === "icbc");
  assert.equal(icbc.precio3CSI, null);
});

test("computeProduct: el override de 3CSI gana y queda independiente", () => {
  const prod = { ...productoDe(FIXTURES[0]), precios3: { fravega: 999000 } };
  const filas = computeProduct(prod, DEFAULT_CONFIG);
  const fravega = filas.find((f) => f.storeKey === "fravega");
  assert.equal(fravega.precio3CSI, 999000); // override, NO el derivado
  assert.equal(fravega.tres3csiIndependiente, true);
  // Megatone sin override sigue derivado del 1 pago.
  const mega = filas.find((f) => f.storeKey === "megatone");
  approx(mega.precio3CSI, FIXTURES[0].precios.megatone * 1.08497992);
  assert.equal(mega.tres3csiIndependiente, false);
});

test("parseReport21: mapea columnas (incluye IVA_coef) y enriquece por SKU", () => {
  const rows = [
    ["Categoria", "SubCategoria", "SKU", "Descripcion", "Cod_Proveedor", "Proveedor", "Marca", "Combo", "Stock valorizado", "Costo zentor", "Cotizacion", "LCostos_USD", "Moneda_LC", "IVA_coef", "IVA", "Ancho", "Largo", "Alto", "Aforo", "PesoGrs", "KG", "Fecha_UCpra", "Fecha_Hoy", "Aging", "ML_Clasica_ARS", "ML_Premium_9CSI", "Ventas", "Ventas Corpo", "Ventas Meli", "Ventas Tiendas", "DOH Meli", "Tasa Vta Meli", "DOH Tiendas", "Tasa Vta Tiendas", "Importe", "Stock 17/06", "DOH Total"],
    ["X", "Y", "AIOKAN0006", "Aire [LP1]", "z", "Prov", "Kanji", "No", 0, 578733.0317, 1455, 0, "ARS", 1.105, 10.5, 1, 1, 1, 11.4, 1000, 1, "", "", 1, 1, 1, 0, 0, 0, 0, "", 0, "", 0, 0, 7, 0],
  ];
  const parsed = parseReport21(rows);
  const p = parsed.porSku.get("AIOKAN0006");
  approx(p.costoSinIVA, 578733.0317);
  approx(p.ivaCoef, 1.105);
  assert.equal(p.esLP, true);
});
