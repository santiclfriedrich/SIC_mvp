import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Gate global de autenticación.
// El matcher (al final del archivo) excluye /login, /api/auth/*, /api/cron/*,
// assets internos y cualquier path con extensión (imágenes, etc).
export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Sin sesión: APIs reciben 401 JSON, navegación browser redirige al login.
  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Rutas /admin/* exigen rol ADMIN.
  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Excluye:
    //   login            → página pública de auth
    //   api/auth/*       → handlers de NextAuth (incluye seed-admin)
    //   api/cron/*       → endpoints de Vercel Cron (auth propia con CRON_SECRET)
    //   _next/*          → assets internos de Next
    //   favicon.ico      → ícono
    //   *.algo           → cualquier archivo con extensión (imágenes en /public)
    "/((?!login|api/auth|api/cron|_next|favicon.ico|.*\\..*).*)",
  ],
};
