"use client";

import { useLogout, useSession } from "@/lib/auth";
import * as labels from "@/lib/labels";

export function UserMenu() {
  const { user, membership } = useSession();
  const logout = useLogout();

  return (
    <div className="border-t border-white/10 pt-4 text-sm">
      <p className="truncate font-medium text-white">{user.display_name ?? user.email}</p>
      <p className="truncate text-xs">
        {membership.org_name} · {labels.role(membership.role).label}
      </p>
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="mt-3 text-xs underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
      >
        로그아웃
      </button>
    </div>
  );
}
