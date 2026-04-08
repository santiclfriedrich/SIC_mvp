// /api/diagnostics/airintra — solo para debug, borrar después
import { NextResponse } from "next/server";
import axios from "axios";

export const runtime     = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const BASE_URL = "https://api.air-intra.com/v2";
  const result   = {};

  // 1. Verificar env vars
  result.env = {
    username: process.env.AIR_INTRA_USERNAME ? "✅ set" : "❌ missing",
    password: process.env.AIR_INTRA_PASSWORD ? "✅ set" : "❌ missing",
    token:    process.env.AIR_INTRA_TOKEN    ? "✅ set" : "❌ missing",
  };

  // 2. Test login
  try {
    const loginRes = await axios.get(`${BASE_URL}/login`, {
      params: {
        user: process.env.AIR_INTRA_USERNAME,
        pass: process.env.AIR_INTRA_PASSWORD,
      },
      timeout: 15000,
    });
    result.login = { status: loginRes.status, data: loginRes.data };
  } catch (err) {
    result.login = { error: err.message };
  }

  // 3. Test page 0 con token del login
  const token = result.login?.data?.token;
  if (token) {
    try {
      const pageRes = await axios.post(
        `${BASE_URL}/articulos?page=0`,
        {},
        {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          timeout: 20000,
          responseType: "text", // recibir como texto para ver qué llega exactamente
        }
      );
      const raw       = pageRes.data;
      const jsonStart = raw.indexOf("[");
      let parsed      = null;
      let parseError  = null;
      try {
        parsed = JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart) : raw);
      } catch (e) {
        parseError = e.message;
      }

      result.page0 = {
        status:       pageRes.status,
        rawLength:    raw.length,
        rawPreview:   raw.slice(0, 500),
        jsonStart,
        parsedLength: Array.isArray(parsed) ? parsed.length : null,
        parseError,
        firstItem:    Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null,
      };
    } catch (err) {
      result.page0 = { error: err.message };
    }
  } else {
    result.page0 = { skipped: "no token from login" };
  }

  return NextResponse.json(result, { status: 200 });
}
