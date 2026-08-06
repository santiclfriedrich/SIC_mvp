"use client";
import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";

// Rutas públicas que NO llevan el shell (sidebar/topbar).
const BARE_PREFIXES = ["/login"];

export function AppChrome({ children }) {
  const pathname = usePathname() || "";
  const bare = BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (bare) return children;
  return <AppShell>{children}</AppShell>;
}
