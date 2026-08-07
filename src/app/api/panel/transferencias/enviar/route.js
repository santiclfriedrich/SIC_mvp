import { prisma } from "@/lib/prisma";
import { sendHtml } from "@/lib/panel/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function cleanEmails(v) {
  let parts = [];
  if (typeof v === "string") parts = v.split(/[,;\s]+/);
  else if (Array.isArray(v)) for (const x of v) parts.push(...String(x).split(/[,;\s]+/));
  const seen = new Set(), out = [];
  for (let p of parts) {
    p = p.trim();
    if (p && EMAIL_RE.test(p) && !seen.has(p.toLowerCase())) { seen.add(p.toLowerCase()); out.push(p); }
  }
  return out;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function emailHtml(items, nota) {
  const sans = "'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const bd = "border:1px solid #d7dde6;padding:7px 12px;";
  const filas = items.map((t) => {
    const cant = parseInt(t.cantidad || 0, 10) || 0;
    return `<tr><td style="${bd}background:#f1f5f9;font-weight:600;letter-spacing:.02em;font-family:${sans};">${esc(t.sku)}</td><td style="${bd}">${esc(t.descripcion)}</td><td style="${bd}text-align:center;">${esc(t.desde)}</td><td style="${bd}text-align:center;">${esc(t.hacia)}</td><td style="${bd}text-align:center;">${cant}</td></tr>`;
  }).join("");
  const notaHtml = nota ? `<p>${esc(nota).replace(/\n/g, "<br>")}</p>` : "<p>Buen día, dejo el detalle:</p>";
  const th = "border:1px solid #334155;padding:8px 12px;text-align:center;color:#ffffff;font-weight:600;";
  return `<div style="font-family:${sans};font-size:14px;color:#0f172a;">${notaHtml}<table style="border-collapse:collapse;font-size:13px;"><thead><tr style="background:#0f172a;"><th style="${th}">SKU</th><th style="${th}">Descripción</th><th style="${th}">Desde</th><th style="${th}">Hacia</th><th style="${th}">Cantidad</th></tr></thead><tbody>${filas}</tbody></table><p>Aguardamos confirmación,<br>Saludos.</p></div>`;
}
function emailText(items, nota) {
  const lines = [nota || "Buen día, dejo el detalle:", ""];
  for (const t of items) lines.push(`- ${t.sku || ""} | ${t.descripcion || ""} | ${t.desde || ""} -> ${t.hacia || ""} | x${parseInt(t.cantidad || 0, 10) || 0}`);
  lines.push("", "Aguardamos confirmación, Saludos.");
  return lines.join("\n");
}
async function meta(key) {
  const rows = await prisma.$queryRawUnsafe(`SELECT value FROM meta WHERE key = '${key}'`);
  if (!rows.length) return null;
  try { return JSON.parse(rows[0].value); } catch { return null; }
}
async function setMeta(key, val) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO meta (key, value) VALUES ('${key}', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    JSON.stringify(val)
  );
}

export async function POST(request) {
  const d = await request.json().catch(() => ({}));
  const to = cleanEmails(d.to);
  const cc = cleanEmails(d.cc);
  const ids = new Set((d.item_ids || []).filter((i) => Number.isInteger(i)));
  const subject = (d.subject || "Transferencia Jura-TML").trim();
  const nota = (d.nota || "").trim();
  if (!to.length) return Response.json({ error: "Falta al menos un destinatario válido." }, { status: 400 });
  if (!ids.size) return Response.json({ error: "No seleccionaste ninguna línea." }, { status: 400 });

  const analysis = (await meta("compras")) || {};
  const todas = analysis.transferencias || [];
  const items = todas.filter((t) => ids.has(t.item_id));
  if (!items.length) {
    return Response.json({ error: "Las líneas seleccionadas ya no están disponibles. Actualizá y probá de nuevo." }, { status: 409 });
  }

  let res;
  try {
    res = await sendHtml(to, subject, emailHtml(items, nota), { cc, text: emailText(items, nota) });
  } catch (e) {
    if (e?.code === "MAIL_NOT_CONFIGURED") {
      return Response.json({ error: "El envío de correo no está configurado en el servidor (faltan SMTP_USER/SMTP_PASS)." }, { status: 503 });
    }
    return Response.json({ error: `No se pudo enviar el correo: ${e?.message || e}` }, { status: 502 });
  }

  const enviadas = (await meta("transf_enviadas")) || {};
  const now = new Date().toISOString().slice(0, 16);
  const destinos = [...res.to, ...res.cc];
  for (const t of items) enviadas[String(t.item_id)] = { at: now, to: destinos };
  const corte = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 16);
  const pruned = {};
  for (const [k, v] of Object.entries(enviadas)) if (String(v.at || "") >= corte) pruned[k] = v;
  await setMeta("transf_enviadas", pruned);

  return Response.json({ ok: true, lineas: items.length, enviado_a: destinos });
}
