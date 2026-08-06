"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getStoredTheme } from "@/lib/theme";

/** Botón sol/luna con transición animada entre temas. */
export function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      className="group relative h-9 w-9 overflow-hidden rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Sun
        size={17}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0"
      />
      <Moon
        size={17}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100"
      />
    </button>
  );
}
