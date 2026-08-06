"use client";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const COLLAPSE_KEY = "sidebar-collapsed";

export function AppShell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false); // drawer en móvil
  const [collapsed, setCollapsed] = useState(false); // solo íconos en desktop

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  const toggleCollapse = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });

  return (
    <div className="flex h-screen flex-col bg-[#f6f7f9] dark:bg-ink-950">
      <TopBar
        onMenu={() => setMenuOpen(true)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      <div className="flex min-h-0 flex-1">
        {menuOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <Sidebar
          open={menuOpen}
          collapsed={collapsed}
          onNavigate={() => setMenuOpen(false)}
        />

        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
