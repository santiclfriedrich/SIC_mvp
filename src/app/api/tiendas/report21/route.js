import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireTiendas } from "@/lib/pricing/server";
import { parseReport21 } from "@/lib/pricing/report21";
import { parsePlanillaPrecios } from "@/lib/pricing/planilla";
import { subirXlsx, trashearArchivo } from "@/lib/reportes-cc/google-client";
import { getPricingConfig } from "@/lib/pricing/config";
import { empujarTodosEnViva, reemplazarReport21EnViva } from "@/lib/pricing/sheet-sync";

export const runtime = "nodejs";
export const maxDuration = 120;

// Postgres limita ~65535 parámetros por statement; chunkeamos el createMany.
const CHUNK = 2000;
// Concurrencia de updates (re-import de SKUs ya existentes).
const UPDATE_CONCURRENCY = 25;

async function readSheet(wb, name) {
  const sheet = wb.Sheets[name];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
}

/**
 * POST /api/tiendas/report21
 * Sube la planilla (o sólo el report21). Reemplaza el snapshot Report21Row con
 * la hoja "report21" e IMPORTA los precios ya seteados de la hoja principal
 * ("AJUSTE formula cobramos-ganamo"), upserteando PricingProduct.
 */
export async function POST(req) {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Body debe ser multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Falta el archivo en el campo 'file'" }, { status: 400 });
  }
  const fileName = file.name || "planilla.xlsx";
  if (!/\.(xls|xlsx)$/i.test(fileName)) {
    return NextResponse.json({ error: "Formato no soportado. Usá .xls o .xlsx" }, { status: 400 });
  }

  let wb, buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
    wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo leer el archivo: " + e.message }, { status: 400 });
  }

  const report21Name = wb.SheetNames.find((n) => /report\s*21/i.test(n));
  const planillaName = wb.SheetNames.find((n) => /cobramos|ajuste/i.test(n));

  if (!report21Name && !planillaName) {
    return NextResponse.json(
      {
        error:
          "El archivo no tiene ni la hoja 'report21' ni la hoja principal de precios ('AJUSTE formula cobramos-ganamo').",
      },
      { status: 422 }
    );
  }

  // ---------- 1) Snapshot del report21 (catálogo base) ----------
  let filasReport21 = 0;
  let r21matrix = null; // matriz cruda para pegar en la pestaña report21 de la viva
  if (report21Name) {
    // Matriz cruda completa (con headers) → para reemplazar la pestaña report21.
    // Dates (cellDates) → string para que la API los acepte.
    r21matrix = XLSX.utils
      .sheet_to_json(wb.Sheets[report21Name], { header: 1, defval: "", raw: true })
      .map((row) =>
        (row || []).map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c))
      );

    const parsed = parseReport21(await readSheet(wb, report21Name));
    if (parsed.total > 0) {
      const data = [...parsed.porSku.values()].map((p) => ({
        sku: p.sku,
        descripcion: p.descripcion || null,
        marca: p.marca || null,
        esLP: p.esLP,
        ivaCoef: p.ivaCoef,
        stock: p.stock,
        costoSinIVA: p.costoSinIVA,
        pesoAforado: p.pesoAforado,
        stockValorizado: p.stockValorizado,
      }));
      await prisma.report21Row.deleteMany({});
      for (let i = 0; i < data.length; i += CHUNK) {
        await prisma.report21Row.createMany({ data: data.slice(i, i + CHUNK), skipDuplicates: true });
      }
      filasReport21 = parsed.total;
    }
  }

  // ---------- 2) Importar precios de la hoja principal ----------
  let preciosImportados = 0;
  let creados = 0;
  let actualizados = 0;
  if (planillaName) {
    const { items } = parsePlanillaPrecios(await readSheet(wb, planillaName));
    preciosImportados = items.length;

    if (items.length > 0) {
      const existentes = await prisma.pricingProduct.findMany({
        select: { sku: true, preciosJson: true, feesJson: true },
      });
      const existMap = new Map(
        existentes.map((e) => [e.sku, { precios: e.preciosJson || {}, fees: e.feesJson || {} }])
      );

      const nuevos = items.filter((it) => !existMap.has(it.sku));
      const aActualizar = items.filter((it) => existMap.has(it.sku));

      // Creates en bloque.
      const createData = nuevos.map((it) => ({
        sku: it.sku,
        descripcion: it.descripcion || null,
        marca: it.marca || null,
        esLP: it.esLP,
        ivaCoef: it.ivaCoef,
        stock: it.stock,
        costoSinIVA: it.costoSinIVA,
        pesoAforado: it.pesoAforado,
        stockValorizado: it.stockValorizado,
        preciosJson: it.precios,
        feesJson: it.fees || {},
        report21At: new Date(),
      }));
      for (let i = 0; i < createData.length; i += CHUNK) {
        await prisma.pricingProduct.createMany({ data: createData.slice(i, i + CHUNK), skipDuplicates: true });
      }
      creados = createData.length;

      // Updates (merge de precios + refresh de base) con concurrencia acotada.
      for (let i = 0; i < aActualizar.length; i += UPDATE_CONCURRENCY) {
        const batch = aActualizar.slice(i, i + UPDATE_CONCURRENCY);
        await Promise.all(
          batch.map((it) =>
            prisma.pricingProduct.update({
              where: { sku: it.sku },
              data: {
                descripcion: it.descripcion || null,
                marca: it.marca || null,
                esLP: it.esLP,
                ivaCoef: it.ivaCoef,
                stock: it.stock,
                costoSinIVA: it.costoSinIVA,
                pesoAforado: it.pesoAforado,
                stockValorizado: it.stockValorizado,
                preciosJson: { ...existMap.get(it.sku).precios, ...it.precios },
                feesJson: { ...existMap.get(it.sku).fees, ...it.fees },
                report21At: new Date(),
              },
            })
          )
        );
      }
      actualizados = aActualizar.length;
    }
  }

  // ---------- 3) Guardar la planilla como MOLDE en Drive (para export a Sheets) ----------
  // SÓLO reemplazamos el molde si el archivo trae la HOJA PRINCIPAL (planilla
  // completa). Si subís un report21 "pelado" (sólo la hoja report21), NO se pisa
  // el molde existente — así no se rompe la planilla viva ni el export.
  const prev = await prisma.report21Upload.findUnique({ where: { id: 1 } });
  let moldeFileId = prev?.moldeFileId || null;
  let moldeError = null;
  if (planillaName) {
    try {
      const nuevoMolde = await subirXlsx(buffer, `MOLDE ${fileName}`);
      if (prev?.moldeFileId) await trashearArchivo(prev.moldeFileId).catch(() => {});
      moldeFileId = nuevoMolde;
    } catch (e) {
      console.error("Error subiendo molde a Drive:", e);
      moldeError = e.message;
    }
  }

  await prisma.report21Upload.upsert({
    where: { id: 1 },
    update: { fuente: fileName, filas: filasReport21, moldeFileId, createdAt: new Date() },
    create: { id: 1, fuente: fileName, filas: filasReport21, moldeFileId },
  });

  // ---------- 4) Reflejar en la planilla viva ----------
  // 4a) Reemplaza la pestaña report21 (borra lo viejo, pega lo nuevo).
  let report21EnSheet = null;
  if (r21matrix) {
    try {
      const res = await reemplazarReport21EnViva(r21matrix);
      if (res.ok) report21EnSheet = { filas: res.filas };
      else console.warn("[report21] pestaña report21 no actualizada:", res.motivo);
    } catch (e) {
      console.error("[report21] Error reemplazando pestaña report21:", e?.message);
    }
  }
  // 4b) Reescribe en la hoja principal el costo/stock/IVA actualizados.
  let planillaActualizada = null;
  try {
    const config = await getPricingConfig();
    const res = await empujarTodosEnViva(config);
    if (res.ok) planillaActualizada = { escritos: res.escritos, agregados: res.agregados };
  } catch (e) {
    console.error("[report21] No se pudo actualizar la planilla viva:", e?.message);
  }

  return NextResponse.json({
    ok: true,
    fuente: fileName,
    filasReport21,
    preciosImportados,
    creados,
    actualizados,
    moldeGuardado: !!moldeFileId,
    moldeError,
    report21EnSheet,
    planillaActualizada,
    hojas: { report21: report21Name || null, planilla: planillaName || null },
  });
}

/** GET /api/tiendas/report21 — metadata de la última carga. */
export async function GET() {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const meta = await prisma.report21Upload.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    upload: meta
      ? { fuente: meta.fuente, filas: meta.filas, createdAt: meta.createdAt.toISOString() }
      : null,
  });
}
