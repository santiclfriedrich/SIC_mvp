"use client";
import { Menu, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";
import { SyncControl } from "./SyncControl";

const SYNC_ROLES = ["ADMIN", "CORPO", "TIENDAS", "CONTABILIDAD"];

export function TopBar({ onMenu, collapsed, onToggleCollapse }) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const iconBtn = "rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white";

  return (
    <header className="z-40 flex h-14 shrink-0 items-center border-b border-slate-800 bg-slate-900 dark:border-ink-700 dark:bg-ink-900">
      <button onClick={onMenu} className={`${iconBtn} ml-2 lg:hidden`} aria-label="Abrir menú">
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-1.5 pl-1 lg:hidden">
        <BrandLogo size={30} plain />
        <span className="text-sm font-light tracking-wide text-white">Argentina Color</span>
      </div>

      <div
        className={[
          "hidden h-full shrink-0 items-center lg:flex",
          collapsed ? "w-16 justify-center" : "w-64 justify-between px-4",
        ].join(" ")}
      >
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            <BrandLogo size={32} plain />
            <span className="text-sm font-light tracking-wide text-white">Argentina Color</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={iconBtn}
          aria-label={collapsed ? "Expandir la barra lateral" : "Contraer la barra lateral"}
          title={collapsed ? "Expandir" : "Contraer"}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3 px-3 sm:px-4">
        {SYNC_ROLES.includes(role) && <SyncControl />}
        {session?.user && (
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">{role}</p>
            <p className="text-sm font-medium text-white/80">{session.user.name || session.user.email}</p>
          </div>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
