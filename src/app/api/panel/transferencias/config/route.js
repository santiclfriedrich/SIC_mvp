import { mailEnabled, mailFromAddress } from "@/lib/panel/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function emailsEnv(name) {
  return (process.env[name] || "").split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
}

export async function GET() {
  return Response.json({
    default_to: emailsEnv("MAIL_TRANSFER_TO"),
    default_cc: emailsEnv("MAIL_TRANSFER_CC"),
    mail_enabled: mailEnabled(),
    from: mailFromAddress() || null,
  });
}
