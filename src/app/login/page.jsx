"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Mail, Lock, AlertTriangle, Loader2 } from "lucide-react";

function mapAuthError(code) {
  if (!code) return "";
  if (code === "CredentialsSignin") return "Email o contraseña incorrectos.";
  return "No se pudo iniciar sesión. Probá de nuevo.";
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const urlErrText = useMemo(() => mapAuthError(urlError), [urlError]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localErr, setLocalErr] = useState("");
  const [loading, setLoading] = useState(false);

  const errToShow = localErr || urlErrText;

  async function onSubmit(e) {
    e.preventDefault();
    setLocalErr("");

    if (!email.trim() || !password) {
      setLocalErr("Completá email y contraseña.");
      return;
    }

    setLoading(true);
    await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/",
    });
    // si falla, vuelve a /login?error=...
    setLoading(false);
  }

  return (
    <div className="min-h-[calc(100vh-80px)] px-4 flex items-center">
      {/* Fondo */}
      <div className="relative mx-auto max-w-6xl">
        <div className="absolute inset-0 -z-10">
          <div className="h-[520px] w-full rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 opacity-[0.08]" />
          <div className="pointer-events-none absolute -top-10 left-10 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-10 right-10 h-56 w-56 rounded-full bg-slate-900/10 blur-3xl" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Columna izquierda (texto) */}
          {/* Columna izquierda (texto) */}
<div className="hidden lg:flex flex-col justify-center px-6">
  <div className="max-w-xl">
    <h1 className="text-3xl font-semibold tracking-tight text-white">
      Una sola plataforma para comparar proveedores.
    </h1>

    <p className="mt-3 text-base leading-relaxed text-slate-200">

      Accedé a precios, stock y condiciones en tiempo real para optimizar el proceso de compra.
    </p>

    <div className="mt-6 space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />
        <p className="text-sm text-slate-300">
          Compará resultados por proveedor y elegí el mejor precio al instante.
        </p>
      </div>

      <div className="flex items-start gap-3">
        <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />
        <p className="text-sm text-slate-300">
          Stock y disponibilidad centralizados para evitar doble trabajo.
        </p>
      </div>

      <div className="flex items-start gap-3">
        <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />
        <p className="text-sm text-slate-300">
          Acceso interno con roles para mantener control y trazabilidad.
        </p>
      </div>
    </div>
  </div>
</div>


          {/* Card login */}
          <div className="flex justify-center">
            <form
              onSubmit={onSubmit}
              className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/80 backdrop-blur shadow-[0_10px_30px_-15px_rgba(2,6,23,0.35)] p-7"
            >
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-900">
                  Ingresar
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Usá tu email corporativo y contraseña.
                </p>
              </div>

              {errToShow && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex gap-2">
                  <AlertTriangle className="mt-0.5" size={18} />
                  <p className="text-sm text-red-700">{errToShow}</p>
                </div>
              )}

              {/* Email */}
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <div className="relative mb-4">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-10 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (localErr) setLocalErr("");
                  }}
                  placeholder="tu.email@argcolor.com"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative mb-6">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-10 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (localErr) setLocalErr("");
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <button
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 text-white py-3 font-medium hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Entrando…
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
