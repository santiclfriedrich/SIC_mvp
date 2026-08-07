// Envío de correos por SMTP (Gmail con "Contraseña de aplicación"), portado
// de mailer.py. Usa nodemailer con import DINÁMICO: así las rutas que solo
// preguntan mailEnabled() no dependen de que el paquete esté instalado.
// Requiere: npm install nodemailer  +  SMTP_USER / SMTP_PASS en el entorno.

export function mailEnabled() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}
export function mailFromAddress() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || "";
}

/** Manda un mail HTML. `to`/`cc` son arrays. Devuelve { to, cc } enviados. */
export async function sendHtml(to, subject, html, { cc = [], text } = {}) {
  if (!mailEnabled()) {
    const e = new Error("SMTP_USER/SMTP_PASS no configurados");
    e.code = "MAIL_NOT_CONFIGURED";
    throw e;
  }
  to = (to || []).filter(Boolean);
  cc = (cc || []).filter(Boolean);
  if (!to.length && !cc.length) throw new Error("sin destinatarios");

  const nodemailer = (await import("nodemailer")).default;
  const name = process.env.MAIL_FROM_NAME || "Argentina Color";
  const from = mailFromAddress();
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: from ? `"${name}" <${from}>` : undefined,
    to,
    cc: cc.length ? cc : undefined,
    subject,
    text: text || "Este mensaje se ve mejor en un cliente con HTML.",
    html,
  });
  return { to, cc };
}
