// Cliente de la API de SGL (sistema del depósito TML) — portado de sgl.py.
// ⚠ SOLO se usa el endpoint de LECTURA GetStock. NUNCA GetDocumentos /
// InsertDocumentos (crean órdenes de trabajo).

export const SGL_EXCLUDE_PREFIXES = ["PALLET", "XEROXALTPALL", "DEVOLUC"];
export const SGL_EXCLUDE_SKUS = ["PO", "NTB1", "PISTOLA TERMOMETRO"];

function cfg() {
  return {
    url: process.env.SGL_API_URL || "https://conexion.tmlogistica.com.ar/SGLAPIS_TML_PROD",
    clientId: process.env.SGL_CLIENT_ID || "argcol",
    clientSecret: process.env.SGL_CLIENT_SECRET || "",
    cliente: parseInt(process.env.SGL_CLIENTE || "54", 10),
  };
}

const numSgl = (v) => {
  const n = parseFloat(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

async function getToken() {
  const c = cfg();
  const r = await fetch(`${c.url}/api/Token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: c.clientId,
      clientSecret: c.clientSecret,
      grantType: "client_credentials",
    }),
  });
  if (!r.ok) throw new Error(`Token SGL HTTP ${r.status}`);
  const j = await r.json();
  if (!j.access_token) throw new Error("SGL no devolvió access_token");
  return j.access_token;
}

/** Stock actual en SGL agregado por SKU (estado FISICO). Devuelve {rows, snapshot}. */
export async function fetchStock() {
  const c = cfg();
  const token = await getToken();
  const url = `${c.url}/api/WMS/Stock/GetStock/${c.cliente}/null/null/true`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`GetStock HTTP ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error("Respuesta inesperada de SGL");

  const exPref = SGL_EXCLUDE_PREFIXES.map((p) => p.toUpperCase());
  const exSku = new Set(SGL_EXCLUDE_SKUS.map((s) => s.toUpperCase()));
  const bySku = {};
  let snapshot = null;
  for (const row of data) {
    const sku = (row.articuloCodigo || "").trim().toUpperCase();
    if (!sku) continue;
    if (exSku.has(sku) || exPref.some((p) => sku.startsWith(p))) continue;
    const estado = (row.estadoDescripcion || "").trim().toUpperCase();
    const e = (bySku[sku] ||= { fisico: 0, descr: "" });
    if (estado === "FISICO") e.fisico += numSgl(row.cantidad);
    if (!e.descr) e.descr = (row.articuloDescripcion || "").trim();
    if (!snapshot && row.fecha) {
      const f = String(row.fecha);
      const h = String(row.hora || "");
      snapshot = f.length === 8 ? `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)} ${h}` : f;
    }
  }
  const rows = Object.entries(bySku).map(([sku, v]) => ({ sku, qty: v.fisico, descr: v.descr }));
  return { rows, snapshot };
}

/** Reemplaza el contenido de sgl_stock y actualiza meta 'sgl_info'. */
export async function replaceSglStock(prisma, rows, sglInfo) {
  await prisma.$executeRawUnsafe(`DELETE FROM sgl_stock`);
  const CH = 500;
  for (let i = 0; i < rows.length; i += CH) {
    const chunk = rows.slice(i, i + CH);
    const vals = [];
    const params = [];
    chunk.forEach((r, j) => {
      const b = j * 3;
      vals.push(`($${b + 1}, $${b + 2}, $${b + 3})`);
      params.push(String(r.sku), Number(r.qty) || 0, r.descr || "");
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO sgl_stock (sku, qty, descr) VALUES ${vals.join(", ")} ` +
        `ON CONFLICT (sku) DO UPDATE SET qty = EXCLUDED.qty, descr = EXCLUDED.descr`,
      ...params
    );
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO meta (key, value) VALUES ('sgl_info', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    JSON.stringify(sglInfo)
  );
}
