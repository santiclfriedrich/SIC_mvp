import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlanillaPrecios } from "./planilla.js";
import { computeProduct } from "./engine.js";
import { DEFAULT_CONFIG } from "./stores.js";

// Reconstruye una fila de la hoja principal con los headers reales en sus
// índices (SKU=2, Marca=3, Descripcion=4, Stock3-6=6, costo=24, peso=25,
// PRECIO-ICBC=119, PRECIO-FRAVEGA-1PAGO=143, PRECIO-MEGATONE- 1PAGO=167,
// ON CITY 1 Pago=191).
function makeRows() {
  const header = [];
  header[0] = "Categoria";
  header[2] = "SKU";
  header[3] = "Marca";
  header[4] = "Descripcion";
  header[6] = "Stock3-6";
  header[24] = "costo s/iva ";
  header[25] = "peso aforado";
  header[119] = "PRECIO-ICBC";
  header[143] = "PRECIO-FRAVEGA-1PAGO";
  header[167] = "PRECIO-MEGATONE- 1PAGO";
  header[191] = "ON CITY 1 Pago";

  const row = [];
  row[2] = "MONKAN0034";
  row[3] = "Kanji";
  row[4] = "Smart Tv Kanji 32 [LP1]";
  row[6] = 3;
  row[24] = 146050.4132;
  row[25] = 18.8;
  row[119] = 256219.334477773;
  row[143] = 281726.91906199686;
  row[167] = 284027.0326420943;
  row[191] = 278587.7375432893;

  // Fila sin precio → se ignora.
  const sinPrecio = [];
  sinPrecio[2] = "VACIO0001";
  sinPrecio[24] = 1000;

  // 8 filas de relleno antes del header (la planilla tiene headers en la fila 9).
  const pad = Array.from({ length: 8 }, () => []);
  return [...pad, header, row, sinPrecio];
}

test("parsePlanillaPrecios: importa base + precios de 1 pago", () => {
  const { items, total } = parsePlanillaPrecios(makeRows());
  assert.equal(total, 1); // la fila sin precio se descarta
  const it = items[0];
  assert.equal(it.sku, "MONKAN0034");
  assert.equal(it.marca, "Kanji");
  assert.equal(it.esLP, true);
  assert.equal(it.stock, 3);
  assert.ok(Math.abs(it.costoSinIVA - 146050.4132) < 1e-6);
  assert.ok(Math.abs(it.pesoAforado - 18.8) < 1e-9);
  assert.deepEqual(Object.keys(it.precios).sort(), ["fravega", "icbc", "megatone", "oncity"]);
  assert.ok(Math.abs(it.precios.icbc - 256219.334477773) < 1e-6);
});

test("precio importado reproduce la renta de la planilla (ICBC 0.1081711457)", () => {
  const { items } = parsePlanillaPrecios(makeRows());
  const filas = computeProduct(items[0], DEFAULT_CONFIG);
  const icbc = filas.find((f) => f.storeKey === "icbc");
  assert.ok(Math.abs(icbc.renta1Pago - 0.1081711457) < 1e-9);
});
