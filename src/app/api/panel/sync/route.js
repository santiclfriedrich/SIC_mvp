import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function setMeta(key, value) {
  const json = JSON.stringify(value).replace(/'/g, "''");
  await prisma.$executeRawUnsafe(
    `INSERT INTO meta (key, value) VALUES ('${key}', '${json}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  );
}

// Dispara el workflow de sync en GitHub Actions (repo de Cotizarg). El trabajo
// pesado corre allá; acá solo se lanza y se marca 'running'.
export async function POST() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const workflow = process.env.GITHUB_WORKFLOW || "sync.yml";
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !repo) {
    return Response.json(
      { started: false, reason: "Falta GITHUB_TOKEN / GITHUB_REPO en el entorno del Next" },
      { status: 503 }
    );
  }
  try {
    const r = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: branch }),
      }
    );
    if (r.status === 204) {
      await setMeta("sync", { state: "running", step: "En cola", detail: "lanzada en la nube, arranca en ~1 min", pct: 1, at: "" });
      return Response.json({ started: true, via: "github-actions" });
    }
    const txt = await r.text().catch(() => "");
    return Response.json({ started: false, reason: `GitHub respondió ${r.status}`, detail: txt.slice(0, 300) }, { status: 502 });
  } catch (e) {
    return Response.json({ started: false, reason: String(e?.message || e) }, { status: 500 });
  }
}
