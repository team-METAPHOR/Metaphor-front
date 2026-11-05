import { Suspense } from "react";
import { AuthGate } from "@/lib/auth";
import { SidebarNav, SidebarNavLinks } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

// 세션 쿠키(sid)는 Path=/api 라서 페이지 요청에 붙지 않는다. 그래서 로그인 확인은
// 브라우저의 AuthGate가 하고, 서버 프리렌더에서는 children이 그려지지 않는다.
// 이 경우 instant navigation 검증이 맞지 않으므로 끈다. 권한 검사는 API 서버가 매 요청 한다.
export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGate>
      <div className="flex min-h-screen">
        <aside className="flex w-60 shrink-0 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground">
          <div className="mb-8 px-3 text-lg font-bold text-white">Metaphor</div>
          <div className="flex-1">
            <Suspense fallback={<SidebarNavLinks pathname="" />}>
              <SidebarNav />
            </Suspense>
          </div>
          <UserMenu />
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </AuthGate>
  );
}
