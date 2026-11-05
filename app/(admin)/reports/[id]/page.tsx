import { Suspense } from "react";
import { ReportDetail } from "./report-detail";

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
