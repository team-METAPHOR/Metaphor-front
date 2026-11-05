import { Suspense } from "react";
import { ReportDetail } from "./report-detail";

// 로그인 확인이 브라우저의 AuthGate에서 일어나 프리렌더에서는 이 페이지가 그려지지 않는다.
// layout의 instant = false는 하위 세그먼트에 상속되지 않으므로 페이지에서도 끈다.
export const instant = false;

async function ReportDetailLoader({ params }: { params: PageProps<"/reports/[id]">["params"] }) {
  const { id } = await params;
  return <ReportDetail reportId={id} />;
}

export default function ReportDetailPage({ params }: PageProps<"/reports/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">불러오는 중…</p>}>
      <ReportDetailLoader params={params} />
    </Suspense>
  );
}
