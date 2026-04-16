"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Lock, AlertTriangle, Loader2, Mail } from "lucide-react";

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
    setLoading(false);
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#F2F1EE] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E3E1DC] shadow-[0_4px_32px_rgba(0,0,0,0.07)] overflow-hidden">

          {/* Top accent */}
          <div className="h-1 w-full bg-gradient-to-r from-[#1D4ED8] to-[#2563EB]" />

          <div className="px-8 py-8">

            {/* Header */}
            <div className="mb-7">
              <h2
                className="text-2xl font-bold text-[#1A1917] tracking-tight mb-1"
                style={{ fontFamily: "var(--font-display, sans-serif)" }}
              >
                Ingresar
              </h2>
              <p className="text-sm text-[#9B978F]">
                Usá tu email corporativo y contraseña.
              </p>
            </div>

            {/* Error */}
            {errToShow && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex gap-2.5 items-start">
                <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{errToShow}</p>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-[#625F5A] mb-1.5 uppercase tracking-wide">
                  Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9B978F]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (localErr) setLocalErr(""); }}
                    placeholder="tu.email@argcolor.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E3E1DC] bg-[#FAFAF9] text-[#1A1917] placeholder-[#C8C5BE] text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-[#625F5A] mb-1.5 uppercase tracking-wide">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9B978F]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (localErr) setLocalErr(""); }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E3E1DC] bg-[#FAFAF9] text-[#1A1917] placeholder-[#C8C5BE] text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 transition-all"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                disabled={loading}
                className="w-full mt-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1e40af] text-white py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={15} />
                    Entrando…
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#C8C5BE] mt-6">
          Argentina Color · Uso interno
        </p>
      </div>
    </div>
  );
}
