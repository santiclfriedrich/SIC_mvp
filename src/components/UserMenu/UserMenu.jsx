"use client";

import { signOut, useSession } from "next-auth/react";

export const UserMenu = () => {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="text-right leading-tight hidden sm:block">
        <p className="text-[10px] text-white/40 font-medium tracking-widest uppercase">
          {session.user.role}
        </p>
        <p className="text-sm text-white/80 font-medium">
          {session.user.username}
        </p>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-xs text-white/40 hover:text-white/80 transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
      >
        Salir
      </button>
    </div>
  );
};
