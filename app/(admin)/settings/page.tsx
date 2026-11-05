import { Suspense } from "react";
import { SettingsView } from "./settings-view";

// 로그인 확인이 브라우저의 AuthGate에서 일어나 프리렌더에서는 이 페이지가 그려지지 않는다.
// layout의 instant = false는 하위 세그먼트에 상속되지 않으므로 페이지에서도 끈다.
export const instant = false;

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">사이트 설정</h1>
        <p className="mt-1 text-sm text-muted">SDK 설치에 필요한 project key와 허용 Origin, 위젯 동작을 관리해요.</p>
      </div>
      {/* useSearchParams는 Suspense 안에서만 쓸 수 있다(cacheComponents). */}
      <Suspense fallback={<p className="text-sm text-muted">불러오는 중…</p>}>
        <SettingsView />
      </Suspense>
    </div>
  );
}
