"use client";

import Link from "next/link";
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
      <div className="mt-3 flex gap-3 text-xs">
        <Link href="/account" className="underline-offset-2 hover:text-white hover:underline">
          계정 설정
        </Link>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
