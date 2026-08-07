import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const wf = process.env.GITHUB_WORKFLOW_NEGATIVOS || "negativos.yml";
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!token || !repo) return Response.json({ started: false, reason: "faltan GITHUB_TOKEN/GITHUB_REPO" }, { status: 500 });
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${wf}/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: branch }),
    });
    if (r.status === 204) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO meta (key, value) VALUES ('compras_status', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        JSON.stringify({ state: "running", step: "En cola", detail: "lanzada en la nube, arranca en ~1 min", at: new Date().toISOString() })
      );
      return Response.json({ started: true, via: "github-actions" });
    }
    const body = await r.text().catch(() => "");
    console.error("[compras/refresh] GitHub", r.status, body);
    return Response.json({ started: false, reason: `GitHub respondió ${r.status}` }, { status: 502 });
  } catch (e) {
    return Response.json({ started: false, reason: String(e?.message || e) }, { status: 502 });
  }
}
