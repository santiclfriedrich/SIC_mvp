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

  // Usuarios CORPO sólo pueden acceder a /corpo/* y a sus APIs.
  // Cualquier otra ruta los redirige a /corpo.
  if (token.role === "CORPO") {
    const corpoAllowed =
      pathname.startsWith("/corpo") ||
      pathname.startsWith("/api/corpo") ||
      pathname.startsWith("/api/auth");
    if (!corpoAllowed) {
      if (isApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/corpo", req.url));
    }
  }

  // Usuarios TIENDAS sólo pueden acceder a /tiendas/* y a sus APIs.
  if (token.role === "TIENDAS") {
    const tiendasAllowed =
      pathname.startsWith("/tiendas") ||
      pathname.startsWith("/api/tiendas") ||
      pathname.startsWith("/api/auth");
    if (!tiendasAllowed) {
      if (isApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/tiendas", req.url));
    }
  }

  // Usuarios CONTABILIDAD sólo pueden acceder a /contabilidad/* y a sus APIs.
  if (token.role === "CONTABILIDAD") {
    const contabilidadAllowed =
      pathname.startsWith("/contabilidad") ||
      pathname.startsWith("/api/contabilidad") ||
      pathname.startsWith("/api/auth");
    if (!contabilidadAllowed) {
      if (isApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/contabilidad", req.url));
    }
  }

  // Rutas /admin/* exigen rol ADMIN.
  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Rutas /corpo/* y /api/corpo/* exigen rol CORPO o ADMIN.
  const isCorpoPath = pathname.startsWith("/corpo") || pathname.startsWith("/api/corpo");
  if (isCorpoPath && token.role !== "CORPO" && token.role !== "ADMIN") {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Rutas /tiendas/* y /api/tiendas/* exigen rol TIENDAS o ADMIN.
  const isTiendasPath =
    pathname.startsWith("/tiendas") || pathname.startsWith("/api/tiendas");
  if (isTiendasPath && token.role !== "TIENDAS" && token.role !== "ADMIN") {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Rutas /contabilidad/* y /api/contabilidad/* exigen rol CONTABILIDAD o ADMIN.
  const isContabilidadPath =
    pathname.startsWith("/contabilidad") || pathname.startsWith("/api/contabilidad");
  if (isContabilidadPath && token.role !== "CONTABILIDAD" && token.role !== "ADMIN") {
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
