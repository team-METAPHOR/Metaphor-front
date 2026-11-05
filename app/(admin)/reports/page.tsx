import { Suspense } from "react";
import { ReportsList } from "./reports-list";

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
