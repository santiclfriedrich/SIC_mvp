"use client";
import Image from "next/image";
import { UserMenu } from "../UserMenu/UserMenu";

export const Header = () => {
  return (
    <header className="w-full bg-gradient-to-r from-[#0F172A] to-[#0B3A66] shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-5">
        {/* Logo / Marca */}
        <div className="flex items-center gap-3">
          <Image
            src="/logo-largo.png"
            alt="Argentina Color"
            width={160}
            height={32}
            className="h-8 w-auto invert brightness-0"
          />
        </div>

        {/* Título */}
        <div className="text-center">
          <p className="text-sm text-blue-200">Compras</p>
          <h1 className="text-2xl font-semibold text-white">
            Comparación Proveedores
          </h1>
        </div>

        {/* Usuario / Logout */}
        <UserMenu />
      </div>
    </header>
  );
};
