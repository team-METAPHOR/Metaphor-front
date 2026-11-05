"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/reports", label: "신고 목록" },
] as const;

export function SidebarNav() {
  return <SidebarNavLinks pathname={usePathname()} />;
}

/** 경로를 모르는 프리렌더 단계에서는 pathname 없이 그린다. */
export function SidebarNavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm ${
              active ? "bg-sidebar-active font-medium text-white" : "hover:bg-sidebar-active/60"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
