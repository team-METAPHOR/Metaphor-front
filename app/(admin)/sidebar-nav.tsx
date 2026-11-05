"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Avatar, Icon, Logo } from "@/components/ui";
import { useLogout, useSession } from "@/lib/auth";
import * as labels from "@/lib/labels";
import { settingsHref, settingsLink } from "./settings-modal/links";

// 페이지를 추가할 때 여기만 고친다.
const navItems = [
  { href: "/dashboard", label: "대시보드", icon: "nav-dashboard" },
  { href: "/reports", label: "제보 목록", icon: "nav-report" },
] as const;

const rowClass = "flex w-full items-center gap-1.5 rounded-lg p-2.5 text-lg leading-none font-medium";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const logout = useLogout();

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col justify-between border-r-2 border-sidebar-border bg-sidebar px-3 pt-6 pb-2 text-sidebar-foreground transition-[width] ${
        collapsed ? "w-[76px]" : "w-60"
      }`}
    >
      <div className="flex flex-col gap-[60px]">
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <Link href="/dashboard" className="px-3" aria-label="SPEAR 대시보드">
              <Logo />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            aria-expanded={!collapsed}
            className="flex size-9 items-center justify-center rounded-md hover:bg-sidebar-active"
          >
            <Icon name="sidebar-collapse" size={28} className={collapsed ? "rotate-180" : undefined} />
          </button>
        </div>
        <Suspense fallback={<NavLinks pathname="" collapsed={collapsed} />}>
          <CurrentNavLinks collapsed={collapsed} />
        </Suspense>
      </div>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          title={collapsed ? "로그아웃" : undefined}
          className={`${rowClass} hover:bg-sidebar-active disabled:opacity-50 ${collapsed ? "justify-center" : ""}`}
        >
          <Icon name="signout" size={22} />
          {!collapsed && (logout.isPending ? "로그아웃 중…" : "로그아웃")}
        </button>
        <UserRow collapsed={collapsed} />
      </div>
    </aside>
  );
}

function CurrentNavLinks({ collapsed }: { collapsed: boolean }) {
  return <NavLinks pathname={usePathname()} collapsed={collapsed} />;
}

/** 경로를 모르는 프리렌더 단계에서는 pathname 없이 그린다. */
function NavLinks({ pathname, collapsed }: { pathname: string; collapsed: boolean }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={`${rowClass} ${collapsed ? "justify-center" : ""} ${
              active ? "bg-sidebar-active" : "hover:bg-sidebar-active/60"
            }`}
          >
            <Icon name={item.icon} size={22} />
            {!collapsed && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserRow({ collapsed }: { collapsed: boolean }) {
  const { user, membership } = useSession();
  const name = user.display_name ?? user.email;

  return (
    <div
      className={`mt-2 flex items-center border-t-2 border-sidebar-border px-2.5 py-3.5 ${
        collapsed ? "justify-center" : "justify-between"
      }`}
    >
      {!collapsed && (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={name} size={34} />
          <div className="flex min-w-0 flex-col gap-1 leading-none font-medium">
            <span className="truncate text-xs text-body">
              {membership.org_name} · {labels.role(membership.role).label}
            </span>
            <span className="truncate text-lg">{name}</span>
          </div>
        </div>
      )}
      {/* useSearchParams는 Suspense 안에서만 쓸 수 있다(cacheComponents). */}
      <Suspense fallback={<SettingsButton href={settingsLink("general")} />}>
        <CurrentSettingsButton />
      </Suspense>
    </div>
  );
}

/** 지금 화면(경로와 필터)을 유지한 채 설정 모달을 연다. */
function CurrentSettingsButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <SettingsButton href={settingsHref(pathname, searchParams, "general")} />;
}

function SettingsButton({ href }: { href: string }) {
  return (
    <Link href={href} scroll={false} aria-label="설정" title="설정" className="flex size-8 items-center justify-center rounded-md hover:bg-sidebar-active">
      <Icon name="gear" size={24} />
    </Link>
  );
}
