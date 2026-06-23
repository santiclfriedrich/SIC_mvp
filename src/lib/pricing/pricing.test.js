// Tests del núcleo de pricing. Corren con el runner nativo de Node (sin deps):
//   node --test src/lib/pricing/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IVA,
  calcForward,
  calcInverse,
  lpRates,
  feePorPeso,
  precio3CSI,
} from "./pricing.js";

// Números de referencia de la planilla real.
const COSTO = 146050.41;

// Tasas tipo Frávega 1 pago (no-LP): comisión 15%, sin CSI.
const fravega1pago = {
  costoSinIVA: COSTO,
  comision: 0.15,
  csi: 0,
  ...lpRates(false), // ingresosBrutos 5,5% / iibLP 0
};

const approx = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `esperado ≈ ${b}, obtuve ${a}`);

test("lpRates hace el swap correcto", () => {
  assert.deepEqual(lpRates(true), { iibLP: 0.055, ingresosBrutos: 0 });
  assert.deepEqual(lpRates(false), { iibLP: 0, ingresosBrutos: 0.055 });
});

test("calcForward: desglose coherente", () => {
  const P = 250000;
  const r = calcForward(P, fravega1pago);
  approx(r.sIVA, P / IVA);
  approx(r.comisionD, P * 0.15);
  approx(r.iib, (P / IVA) * 0.055);
  approx(r.difIIB, 0); // no-LP → iibLP 0
  approx(r.logist, P * 0.03);
  approx(r.pw, P * 0.028);
  approx(r.rentaPct, r.ganamos / r.sIVA);
});

test("forward(inverse(t)).rentaPct ≈ t  (sin fee)", () => {
  for (const t of [0.04, 0.045, 0.05, 0.08, 0.12]) {
    const P = calcInverse(t, fravega1pago);
    const r = calcForward(P, fravega1pago);
    approx(r.rentaPct, t, 1e-9);
  }
});

test("forward(inverse(t)).rentaPct ≈ t  (con fee y LP)", () => {
  const params = {
    costoSinIVA: COSTO,
    comision: 0.14,
    csi: 0.0968,
    fee: 4235.5,
    ...lpRates(true), // LP
  };
  for (const t of [0.04, 0.05, 0.07]) {
    const P = calcInverse(t, params);
    const r = calcForward(P, params);
    approx(r.rentaPct, t, 1e-9);
  }
});

test("calcInverse: precio positivo y razonable para 4-5%", () => {
  const P = calcInverse(0.045, fravega1pago);
  assert.ok(P > COSTO, "el precio debe superar el costo s/IVA");
  assert.ok(Number.isFinite(P));
});

test("feePorPeso: MATCH aproximado (último desde <= peso)", () => {
  const tramos = [
    { desdeKg: 0, hastaKg: 2, feeConIVA: 1000 },
    { desdeKg: 2, hastaKg: 10, feeConIVA: 2000 },
    { desdeKg: 10, hastaKg: 30, feeConIVA: 3000 },
  ];
  assert.equal(feePorPeso(1.5, tramos), 1000);
  assert.equal(feePorPeso(2, tramos), 2000); // límite compartido → tramo superior
  assert.equal(feePorPeso(9.99, tramos), 2000);
  assert.equal(feePorPeso(25, tramos), 3000);
  assert.equal(feePorPeso(100, tramos), 3000); // pesado → clampa al último tramo
  assert.equal(feePorPeso(5, []), 0); // sin tabla
});

test("feePorPeso: peso por debajo del primer tramo → 0", () => {
  const tramos = [{ desdeKg: 1, hastaKg: 5, feeConIVA: 2000 }];
  assert.equal(feePorPeso(0.5, tramos), 0);
});

test("feePorPeso: huecos entre tramos toman el tramo anterior (estilo Frávega)", () => {
  const tramos = [
    { desdeKg: 0, hastaKg: 1.5, feeConIVA: 5219, feeConIVA30mil: 1229 },
    { desdeKg: 1.51, hastaKg: 5, feeConIVA: 6669, feeConIVA30mil: 3334.5 },
  ];
  assert.equal(feePorPeso(1.5, tramos), 5219); // cae en el hueco 1.5–1.51
  assert.equal(feePorPeso(1.51, tramos), 6669);
});

test("feePorPeso: regla -30mil usa la columna explícita si precio < 30000", () => {
  const tramos = [
    { desdeKg: 0, hastaKg: 1.5, feeConIVA: 5219, feeConIVA30mil: 1229 },
  ];
  assert.equal(
    feePorPeso(1, tramos, { precio: 25000, aplicaRegla30mil: true }),
    1229 // columna explícita, NO la mitad de 5219
  );
  assert.equal(
    feePorPeso(1, tramos, { precio: 35000, aplicaRegla30mil: true }),
    5219
  );
  // sin columna explícita → cae a la mitad
  assert.equal(
    feePorPeso(1, [{ desdeKg: 0, hastaKg: 5, feeConIVA: 2000 }], {
      precio: 25000,
      aplicaRegla30mil: true,
    }),
    1000
  );
  // regla desactivada → fee completo aunque sea barato
  assert.equal(
    feePorPeso(1, tramos, { precio: 25000, aplicaRegla30mil: false }),
    5219
  );
});

test("precio3CSI: aplica el coeficiente de la tienda", () => {
  approx(precio3CSI(100000, 1.12315828), 112315.828);
  approx(precio3CSI(100000, 1.08497992), 108497.992);
});
