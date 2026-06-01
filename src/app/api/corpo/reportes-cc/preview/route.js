import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  parsearClientes,
  filtrarYOrdenar,
  calcularTotales,
  deudaPorVendedor,
} from "@/lib/reportes-cc/parser";
import { VENDEDORES_EXCLUIDOS, UMBRAL_SALDO } from "@/lib/reportes-cc/config";

export const runtime = "nodejs";

export async function POST(req) {
  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Body debe ser multipart/form-data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "Falta el archivo en el campo 'file'" },
      { status: 400 }
    );
  }

  const fileName = file.name || "archivo.xlsx";
  const ext = fileName.toLowerCase();
  if (!ext.endsWith(".xls") && !ext.endsWith(".xlsx")) {
    return NextResponse.json(
      { error: "Formato no soportado. Usá .xls o .xlsx" },
      { status: 400 }
    );
  }

  let datos;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    datos = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudo leer el archivo: " + e.message },
      { status: 400 }
    );
  }

  const todosLosClientes = parsearClientes(datos);
  if (todosLosClientes.length === 0) {
    return NextResponse.json(
      {
        error:
          "No se detectaron clientes en el archivo. ¿Es el reporte crudo de cuentas corrientes del ERP?",
      },
      { status: 422 }
    );
  }

  const { clientes, excluidos } = filtrarYOrdenar(todosLosClientes);
  const totales = calcularTotales(clientes);
  const porVendedor = deudaPorVendedor(clientes);
  const top10 = clientes.slice(0, 10).map((c) => ({
    numero: String(c.numero ?? ""),
    nombre: c.nombre ?? "",
    saldo: c.saldo_total || 0,
  }));

  return NextResponse.json({
    fuente: fileName,
    filas: datos.length,
    config: {
      vendedoresExcluidos: VENDEDORES_EXCLUIDOS,
      umbralSaldo: UMBRAL_SALDO,
    },
    totales,
    excluidos,
    clientes: clientes.map((c) => ({
      numero: String(c.numero ?? ""),
      nombre: c.nombre ?? "",
      vendedor: c.vendedoresStr || "—",
      cantComprobantes: c.comprobantes.length,
      saldoTotal: c.saldo_total || 0,
    })),
    top10,
    porVendedor,
  });
}
