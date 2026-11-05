import { Suspense } from "react";
import { ReportsList } from "./reports-list";

// 로그인 확인이 브라우저의 AuthGate에서 일어나 프리렌더에서는 이 페이지가 그려지지 않는다.
// layout의 instant = false는 하위 세그먼트에 상속되지 않으므로 페이지에서도 끈다.
export const instant = false;

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">신고 목록</h1>
      {/* 필터를 URL 쿼리(useSearchParams)에서 읽으므로 Suspense 안에 둔다. */}
      <Suspense fallback={<p className="text-sm text-muted">불러오는 중…</p>}>
        <ReportsList />
      </Suspense>
    </div>
  );
}
