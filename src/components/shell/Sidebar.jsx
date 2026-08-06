"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LayoutGrid, Users, Store, Calculator, Shield, LogOut } from "lucide-react";

// Áreas actuales de Cotizarg. Los grupos del panel BI (Almacenamiento/Ventas),
// el ítem "Cotizarg" dentro de Compras y el ajuste fino de roles = Fase 3.
const NAV = [
  { href: "/", label: "Comparador", icon: LayoutGrid, roles: ["ADMIN", "USER", "VIEWER"], exact: true },
  { href: "/corpo", label: "Corpo", icon: Users, roles: ["ADMIN", "CORPO"] },
  { href: "/tiendas", label: "Tiendas", icon: Store, roles: ["ADMIN", "TIENDAS"] },
  { href: "/contabilidad", label: "Contabilidad", icon: Calculator, roles: ["ADMIN", "CONTABILIDAD"] },
  { href: "/admin/users", label: "Admin", icon: Shield, roles: ["ADMIN"] },
];

export function Sidebar({ open = false, collapsed = false, onNavigate }) {
  const pathname = usePathname() || "";
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  const items =
    status === "authenticated" && role ? NAV.filter((i) => i.roles.includes(role)) : [];

  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <aside
      className={[
        "z-40 flex shrink-0 flex-col bg-slate-900 text-slate-300 transition-all duration-200 dark:border-r dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300",
        "fixed inset-y-0 left-0 max-lg:w-64 lg:static lg:translate-x-0",
        collapsed ? "lg:w-16" : "lg:w-64",
        open ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
    >
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={item.label}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : "",
                active
                  ? "bg-brand-600 text-white dark:bg-ink-700 dark:text-white"
                  : "hover:bg-slate-800 hover:text-white dark:hover:bg-ink-800",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Icon size={18} />
              <span className={collapsed ? "lg:hidden" : undefined}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-3 py-3 dark:border-ink-700">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Cerrar sesión"
          className={[
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white dark:text-ink-400 dark:hover:bg-ink-800",
            collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <LogOut size={18} />
          <span className={collapsed ? "lg:hidden" : undefined}>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
