"use client";

import { signOut, useSession } from "next-auth/react";

export const UserMenu = () => {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-4 text-right">
      <div className="leading-tight">
        <p className="text-xs text-blue-200">
          {session.user.role}
        </p>
        <p className="text-sm text-white font-medium">
          {session.user.username}
        </p>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-sm text-blue-200 hover:text-white underline"
      >
        Salir
      </button>
    </div>
  );
};
