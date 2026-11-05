import { Suspense } from "react";
import { AuthGate } from "@/lib/auth";
import { SettingsModal } from "./settings-modal/settings-modal";
import { Sidebar } from "./sidebar-nav";

// 세션 쿠키(sid)는 Path=/api 라서 페이지 요청에 붙지 않는다. 그래서 로그인 확인은
// 브라우저의 AuthGate가 하고, 서버 프리렌더에서는 children이 그려지지 않는다.
// 이 경우 instant navigation 검증이 맞지 않으므로 끈다. 권한 검사는 API 서버가 매 요청 한다.
export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <AuthGate>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 px-6 py-10 md:px-[52px] md:py-14">
            <div className="mx-auto max-w-[1096px]">{children}</div>
          </main>
        </div>
        {/* useSearchParams는 Suspense 안에서만 쓸 수 있다(cacheComponents). */}
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      </AuthGate>
    </div>
  );
}
