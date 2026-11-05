import { Suspense } from "react";

async function ReportTitle({ params }: { params: PageProps<"/reports/[id]">["params"] }) {
  const { id } = await params;
  return <h1 className="text-2xl font-bold">신고 {id}</h1>;
}

export default function ReportDetailPage({ params }: PageProps<"/reports/[id]">) {
  return (
    <Suspense>
      <ReportTitle params={params} />
    </Suspense>
  );
}
