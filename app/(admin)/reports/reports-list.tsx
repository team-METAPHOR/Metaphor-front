"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { JobStatusBadge, VerdictBadge, WorkflowBadge } from "@/components/badge";
import { ApiError, api, type Schemas } from "@/lib/api";
import * as labels from "@/lib/labels";

type ReportList = Schemas["ReportList"];
type ProgramList = Schemas["ProgramList"];

const PAGE_SIZE = 20;

const SOURCES = [
  { value: "widget", label: "위젯" },
  { value: "platform", label: "플랫폼" },
] as const;

const dateFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

/** URL 쿼리의 필터를 읽고, 필터가 바뀌면 페이지 위치(cursor 스택)를 처음으로 되돌린다. */
export function ReportsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const programId = searchParams.get("program_id") ?? "";
  const source = searchParams.get("source") ?? "";

  const programs = useQuery({ queryKey: ["programs"], queryFn: () => api<ProgramList>("/programs") });

  function setFilter(name: "program_id" | "source", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">사이트</span>
          <select
            value={programId}
            onChange={(e) => setFilter("program_id", e.target.value)}
            className="min-w-48 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <option value="">전체</option>
            {programs.data?.items.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">유입 경로</span>
          <select
            value={source}
            onChange={(e) => setFilter("source", e.target.value)}
            className="min-w-32 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <option value="">전체</option>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {programs.error && <p className="text-sm text-red-600">사이트 목록을 불러오지 못했어요.</p>}
      </div>
      <ReportsTable
        key={`${programId}|${source}`}
        programId={programId}
        source={source}
        programNames={new Map(programs.data?.items.map((p) => [p.id, p.name]))}
      />
    </>
  );
}

function ReportsTable({
  programId,
  source,
  programNames,
}: {
  programId: string;
  source: string;
  programNames: Map<string, string>;
}) {
  const router = useRouter();
  // 지나온 페이지의 cursor. 첫 페이지는 null.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];

  const reports = useQuery({
    queryKey: ["reports", { programId, source, cursor }],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      if (programId) params.set("program_id", programId);
      if (source) params.set("source", source);
      return api<ReportList>(`/reports?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  if (reports.isPending) return <p className="text-sm text-muted">불러오는 중…</p>;
  if (reports.error) return <ErrorMessage error={reports.error} />;

  const { items, next_cursor: nextCursor } = reports.data;

  return (
    <div className="flex flex-col gap-4">
      {/* contain: 표 너비가 main(flex item)을 밀어 넓히지 않고 이 안에서 가로 스크롤되게 한다. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface [contain:inline-size]">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">제목</th>
              <th className="px-4 py-3 font-medium">사이트</th>
              <th className="px-4 py-3 font-medium">유형</th>
              <th className="px-4 py-3 font-medium">처리 상태</th>
              <th className="px-4 py-3 font-medium">실행 상태</th>
              <th className="px-4 py-3 font-medium">재현 판정</th>
              <th className="px-4 py-3 font-medium">중복</th>
              <th className="px-4 py-3 font-medium">접수 시각</th>
            </tr>
          </thead>
          <tbody className={reports.isPlaceholderData ? "opacity-60" : undefined}>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted">
                  신고가 없어요.
                </td>
              </tr>
            ) : (
              items.map((report) => (
                <tr
                  key={report.id}
                  onClick={() => router.push(`/reports/${report.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-background"
                >
                  <td className="max-w-80 px-4 py-3">
                    <Link
                      href={`/reports/${report.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate font-medium hover:text-primary"
                    >
                      {report.title || <span className="text-muted">(제목 없음)</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {programNames.get(report.program_id) ?? <span className="text-muted">{report.program_id}</span>}
                  </td>
                  <td className="px-4 py-3">{labels.errorType(report.error_type).label}</td>
                  <td className="px-4 py-3">
                    <WorkflowBadge value={report.workflow_status} />
                  </td>
                  <td className="px-4 py-3">
                    <JobStatusBadge value={report.latest_job?.status} />
                  </td>
                  <td className="px-4 py-3">
                    <VerdictBadge value={report.latest_job?.verdict} />
                  </td>
                  <td className="px-4 py-3">
                    {report.duplicate_count > 0 ? `${report.duplicate_count}건` : ""}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {dateFormat.format(new Date(report.created_at))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={cursors.length === 1 || reports.isFetching}
          onClick={() => setCursors((stack) => stack.slice(0, -1))}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm disabled:opacity-40"
        >
          이전
        </button>
        <button
          type="button"
          disabled={!nextCursor || reports.isFetching}
          onClick={() => nextCursor && setCursors((stack) => [...stack, nextCursor])}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </div>
  );
}

function ErrorMessage({ error }: { error: Error }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <p>신고 목록을 불러오지 못했어요. {error.message}</p>
      {error instanceof ApiError && error.requestId && (
        <p className="mt-1 text-xs text-red-600">요청 ID: {error.requestId}</p>
      )}
    </div>
  );
}
