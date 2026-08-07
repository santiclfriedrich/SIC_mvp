"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Boxes, LayoutGrid, Package, Warehouse, ArrowLeftRight, History,
  ShoppingCart, TrendingDown, Search, TrendingUp, LineChart, Store, ClipboardList,
  Users, Calculator, Shield, ChevronDown, LogOut,
} from "lucide-react";

// Orden y grupos replicados de bi-stock. El Comparador va dentro de Compras.
const GROUPS = [
  {
    key: "almacenamiento", label: "Almacenamiento", icon: Boxes,
    roles: ["ADMIN", "CORPO", "TIENDAS", "CONTABILIDAD"],
    items: [
      { to: "/panel/resumen", label: "Resumen", icon: LayoutGrid },
      { to: "/panel/articulos", label: "Artículos", icon: Package },
      { to: "/panel/depositos", label: "Depósitos", icon: Warehouse },
      { to: "/panel/diferencias", label: "Diferencias TML", icon: ArrowLeftRight },
      { to: "/panel/historico", label: "Histórico", icon: History },
    ],
  },
  {
    key: "compras", label: "Compras", icon: ShoppingCart,
    roles: ["ADMIN", "CORPO", "TIENDAS", "CONTABILIDAD", "USER", "VIEWER"],
    items: [
      { to: "/panel/compras/negativos", label: "Negativos / Comprar", icon: TrendingDown, roles: ["ADMIN", "CORPO", "TIENDAS", "CONTABILIDAD"] },
      { to: "/panel/compras/ml-full", label: "ML Full", icon: Package, roles: ["ADMIN", "CORPO", "TIENDAS", "CONTABILIDAD"] },
      { to: "/panel/compras/transferencias", label: "Transferencias", icon: ArrowLeftRight, roles: ["ADMIN", "CORPO", "TIENDAS", "CONTABILIDAD"] },
      { to: "/", label: "Comparador", icon: Search, end: true },
    ],
  },
  {
    key: "ventas", label: "Ventas", icon: TrendingUp,
    roles: ["ADMIN", "CORPO", "TIENDAS", "CONTABILIDAD"],
    items: [
      { to: "/panel/ventas", label: "Resumen", icon: LineChart, end: true },
      { to: "/panel/ventas/canal/b2c", label: "Canales", icon: Store, matchPrefix: "/panel/ventas/canal" },
      { to: "/panel/ventas/pedidos", label: "Pedidos", icon: ClipboardList },
    ],
  },
  {
    key: "gestion", label: "Gestión", icon: Shield,
    roles: ["ADMIN", "CORPO", "TIENDAS", "CONTABILIDAD"],
    items: [
      { to: "/corpo", label: "Corpo", icon: Users, roles: ["ADMIN", "CORPO"] },
      { to: "/tiendas", label: "Tiendas", icon: Store, roles: ["ADMIN", "TIENDAS"] },
      { to: "/contabilidad", label: "Contabilidad", icon: Calculator, roles: ["ADMIN", "CONTABILIDAD"] },
      { to: "/admin/users", label: "Admin", icon: Shield, roles: ["ADMIN"] },
    ],
  },
];

function itemAllowed(item, group, role) {
  const allowed = item.roles || group.roles;
  if (!allowed) return true;
  return role ? allowed.includes(role) : false;
}

const leafClass = (active, collapsed) =>
  [
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
    collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : "",
    active
      ? "bg-brand-600 text-white dark:bg-ink-700 dark:text-white"
      : "hover:bg-slate-800 hover:text-white dark:hover:bg-ink-800",
  ].filter(Boolean).join(" ");

function NavGroup({ group, role, collapsed, pathname, onNavigate }) {
  const items = group.items.filter((i) => itemAllowed(i, group, role));
  const storageKey = `menu-${group.key}-open`;
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try { setOpen(localStorage.getItem(storageKey) !== "0"); } catch {}
  }, [storageKey]);
  if (items.length === 0) return null;

  const isActive = (item) =>
    item.end ? pathname === item.to
    : item.matchPrefix ? pathname.startsWith(item.matchPrefix)
    : pathname === item.to || pathname.startsWith(item.to + "/");

  const toggle = () =>
    setOpen((v) => {
      try { localStorage.setItem(storageKey, v ? "0" : "1"); } catch {}
      return !v;
    });

  const Icon = group.icon;
  return (
    <div className="mb-1">
      {!collapsed && (
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-800 hover:text-white dark:hover:bg-ink-800"
          aria-expanded={open}
        >
          <Icon size={18} />
          <span className="flex-1 text-left font-medium">{group.label}</span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        </button>
      )}
      <div className={["mt-1 space-y-1", collapsed ? "" : "pl-4", !collapsed && !open ? "hidden" : ""].filter(Boolean).join(" ")}>
        {items.map((item) => {
          const ItemIcon = item.icon;
          return (
            <Link
              key={item.to}
              href={item.to}
              onClick={onNavigate}
              title={item.label}
              className={leafClass(isActive(item), collapsed)}
            >
              <ItemIcon size={18} />
              <span className={collapsed ? "lg:hidden" : undefined}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar({ open = false, collapsed = false, onNavigate }) {
  const pathname = usePathname() || "";
  const { data: session, status } = useSession();
  const role = status === "authenticated" ? session?.user?.role : null;

  return (
    <aside
      className={[
        "z-40 flex shrink-0 flex-col bg-slate-900 text-slate-300 transition-all duration-200 dark:border-r dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300",
        "fixed inset-y-0 left-0 max-lg:w-64 lg:static lg:translate-x-0",
        collapsed ? "lg:w-16" : "lg:w-64",
        open ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
    >
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map((group) => (
          <NavGroup
            key={group.key}
            group={group}
            role={role}
            collapsed={collapsed}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="border-t border-slate-800 px-3 py-3 dark:border-ink-700">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Cerrar sesión"
          className={[
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white dark:text-ink-400 dark:hover:bg-ink-800",
            collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : "",
          ].filter(Boolean).join(" ")}
        >
          <LogOut size={18} />
          <span className={collapsed ? "lg:hidden" : undefined}>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
