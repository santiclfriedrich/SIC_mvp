"use client";
import Image from "next/image";
import { UserMenu } from "../UserMenu/UserMenu";

export const Header = () => {
  return (
    <header className="w-full bg-[#0D1829] border-b border-white/[0.06] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">

        {/* Marca */}
        <div className="flex items-center gap-3">
          <Image
            src="/logo-largo.png"
            alt="Argentina Color"
            width={140}
            height={28}
            className="h-7 w-auto brightness-0 invert opacity-90"
          />
          <span className="hidden sm:block h-3.5 w-px bg-white/20" />
          <span className="hidden sm:block text-[11px] font-medium text-white/40 tracking-widest uppercase">
            Compras
          </span>
        </div>

{/* Usuario */}
        <UserMenu />
      </div>
    </header>
  );
};
