import { Suspense } from "react";
import LoginPageClient from "./LoginPageClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-80px)] px-4 flex items-center justify-center">Cargando...</div>}>
      <LoginPageClient />
    </Suspense>
  );
}