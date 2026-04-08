// /api/diagnostics/providers?q=notebook
//
// Tests each provider independently and returns detailed status.
// Use this to understand which providers are working in production.
// No controller-level timeouts here — raw provider results with full timing.

import { NextResponse } from "next/server";

import { fetchProductsFromElit,    isElitCacheWarm }   from "@/lib/services/elitAPI";
import { fetchProductsFromMasnet,  isMasnetCacheWarm } from "@/lib/services/masnetAPI";
import { fetchProductsFromCorcisa, isCorcisaCacheWarm} from "@/lib/services/corcisaAPI";
import { fetchProductsFromNucleo,  isNucleoCacheWarm } from "@/lib/services/nucleoAPI";
import { fetchProductsFromPcarts,  isPcartsCacheWarm } from "@/lib/services/pcartsAPI";
import { fetchProductsFromInvid,       isInvidCacheWarm }       from "@/lib/services/invidAPI";
import { fetchProductsFromSolutionbox, isSolutionboxCacheWarm } from "@/lib/services/solutionboxAPI";
import { fetchProductsFromMicroglobal, isMicroglobalCacheWarm } from "@/lib/services/microglobalAPI";

import { cacheGet, cacheSet }  from "@/lib/cache/redisCache";

export const runtime    = "nodejs";
export const maxDuration = 60;

const PROVIDERS = (q) => [
  {
    name:     "Elit",
    fn:       () => fetchProductsFromElit(q),
    isWarm:   () => isElitCacheWarm(),
  },
  {
    name:     "Masnet",
    fn:       () => fetchProductsFromMasnet(q),
    isWarm:   () => isMasnetCacheWarm(q),
  },
  {
    name:     "Corcisa",
    fn:       () => fetchProductsFromCorcisa(q),
    isWarm:   () => isCorcisaCacheWarm(),
  },
  {
    name:     "Nucleo",
    fn:       () => fetchProductsFromNucleo(q),
    isWarm:   () => isNucleoCacheWarm(),
  },
  {
    name:     "PCArts",
    fn:       () => fetchProductsFromPcarts(q),
    isWarm:   () => isPcartsCacheWarm(),
  },
  {
    name:     "Invid",
    fn:       () => fetchProductsFromInvid(q),
    isWarm:   () => isInvidCacheWarm(),
  },
  {
    name:     "SolutionBox",
    fn:       () => fetchProductsFromSolutionbox(q),
    isWarm:   () => isSolutionboxCacheWarm(),
  },
  {
    name:     "Microglobal",
    fn:       () => fetchProductsFromMicroglobal(q),
    isWarm:   () => isMicroglobalCacheWarm(),
  },
];

/** Classify a caught error into a readable type */
function classifyError(err) {
  const code = err.code ?? err.cause?.code ?? null;
  const msg  = String(err.message ?? "").toLowerCase();

  if (code === "ENOTFOUND"  || msg.includes("enotfound"))   return "DNS_FAILURE";
  if (code === "ECONNREFUSED")                               return "CONN_REFUSED";
  if (code === "ECONNRESET" || msg.includes("econnreset"))  return "CONN_RESET";
  if (code === "ETIMEDOUT"  || msg.includes("etimedout"))   return "NET_TIMEOUT";
  if (msg.includes("fetch failed"))                         return "FETCH_FAILED";
  if (msg.includes("abort"))                                return "ABORTED";
  if (err.isAxiosError && !err.response)                    return "NETWORK_FAILURE";
  if (err.response?.status === 401)                         return "AUTH_401";
  if (err.response?.status === 403)                         return "AUTH_403";
  if (err.response?.status === 429)                         return "RATE_LIMITED";
  if (err.response?.status >= 500)                          return "SERVER_ERROR";
  return "UNKNOWN";
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "notebook").trim();

  // ── Redis health ──────────────────────────────────────────────────────
  const redisResult = { ok: false, ms: null, error: null };
  try {
    const t0 = Date.now();
    await cacheSet("diag:ping", "pong", 10);
    const val = await cacheGet("diag:ping");
    redisResult.ok = val === "pong";
    redisResult.ms = Date.now() - t0;
  } catch (err) {
    redisResult.error = err.message;
  }

  // ── Per-provider test (run in parallel, no extra timeout) ─────────────
  const providerTests = await Promise.allSettled(
    PROVIDERS(q).map(async ({ name, fn, isWarm }) => {
      const warm = isWarm();
      const t0   = Date.now();

      try {
        const data    = await fn();
        const elapsed = Date.now() - t0;
        const items   = Array.isArray(data) ? data : [];

        // Sample: first 2 items showing raw key fields
        const sample = items.slice(0, 2).map((p) => ({
          sku:  p.sku ?? p.codigo_producto ?? p.partNumber ?? p.codigo ?? null,
          name: p.name ?? p.nombre ?? p.item_desc_0 ?? p.sku_desc ?? null,
        }));

        // SKU coverage: how many items have a non-empty sku field
        const skuCoverage = items.length > 0
          ? `${items.filter((p) => p.sku).length}/${items.length}`
          : "N/A";

        return {
          name,
          ok:          true,
          cacheState:  warm ? "WARM" : "COLD",
          elapsed,
          count:       items.length,
          skuCoverage,
          sample,
        };
      } catch (err) {
        return {
          name,
          ok:         false,
          cacheState: warm ? "WARM" : "COLD",
          elapsed:    Date.now() - t0,
          errType:    classifyError(err),
          errCode:    err.code ?? err.cause?.code ?? null,
          errMessage: err.message,
          httpStatus: err.response?.status ?? null,
        };
      }
    })
  );

  // Flatten allSettled results (inner try/catch means they should all fulfill)
  const providers = providerTests.map((r) =>
    r.status === "fulfilled" ? r.value : { ok: false, errMessage: r.reason?.message }
  );

  // ── Summary ───────────────────────────────────────────────────────────
  const okCount     = providers.filter((p) => p.ok).length;
  const totalItems  = providers.filter((p) => p.ok).reduce((s, p) => s + p.count, 0);

  return NextResponse.json(
    {
      query:     q,
      timestamp: new Date().toISOString(),
      redis:     redisResult,
      summary: {
        providersOk:   `${okCount}/${providers.length}`,
        totalProducts: totalItems,
      },
      providers,
    },
    { status: 200 }
  );
}
