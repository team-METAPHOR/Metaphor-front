"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { JobStatusBadge, ProgressBadge, VerdictBadge } from "@/components/badge";
import { ApiError, api, type Schemas } from "@/lib/api";
import { type Bar, computeStats } from "./stats";

type Report = Schemas["ReportItem"];
type ReportList = Schemas["ReportList"];
type ProgramList = Schemas["ProgramList"];

// 통계 API가 없어 목록을 모두 받아 브라우저에서 계산한다. 해커톤 규모 기준 상한.
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

async function fetchAllReports(signal: AbortSignal): Promise<{ items: Report[]; truncated: boolean }> {
  const items: Report[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) query.set("cursor", cursor);
    const data: ReportList = await api<ReportList>(`/reports?${query}`, { signal });
    items.push(...data.items);
    if (!data.next_cursor) return { items, truncated: false };
    cursor = data.next_cursor;
  }
  return { items, truncated: true };
}

const toneBar: Record<Bar["tone"], string> = {
  neutral: "bg-gray-400",
  info: "bg-primary",
  progress: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export function DashboardView() {
  const reports = useQuery({
    queryKey: ["dashboard", "reports"],
    queryFn: ({ signal }) => fetchAllReports(signal),
  });
  const programs = useQuery({ queryKey: ["programs"], queryFn: () => api<ProgramList>("/programs") });

  if (reports.isPending) return <p className="text-sm text-muted">신고를 불러오는 중…</p>;
  if (reports.isError) {
    const error = reports.error;
    const detail = error instanceof ApiError && error.requestId ? ` (요청 ID: ${error.requestId})` : "";
    return (
      <p role="alert" className="text-sm text-red-600">
        신고 목록을 불러오지 못했어요. {error.message}
        {detail}
      </p>
    );
  }

  const stats = computeStats(reports.data.items, programs.data?.items ?? []);
  const rate = stats.reproducedRate === null ? "-" : `${Math.round(stats.reproducedRate * 100)}%`;

  return (
    <div className="space-y-6">
      {reports.data.truncated && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          신고가 많아 최근 {PAGE_SIZE * MAX_PAGES}건까지만 계산했어요.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="전체 신고" value={stats.total.toLocaleString("ko-KR")} unit="건" />
        <Metric
          label="AI 재현 성공률"
          value={rate}
          note={
            stats.judgedCount > 0
              ? `판정된 ${stats.judgedCount}건 중 재현됨 ${stats.reproduced}건`
              : "판정된 신고가 아직 없어요."
          }
        />
        <Metric
          label="미처리"
          value={stats.pending.toLocaleString("ko-KR")}
          unit="건"
          note="처리 상태가 신규인 신고예요."
        />
        <Metric
          label="평균 처리 시간"
          value={stats.avgCloseMs === null ? "-" : formatDuration(stats.avgCloseMs)}
          note={
            stats.closedCount > 0
              ? `마감된 ${stats.closedCount}건의 접수부터 마감까지`
              : "마감된 신고가 아직 없어요."
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="진행 단계" description="신규 신고 → 재현 중 → 재현 완료 → 버그 수정 중 → 마감">
          <BarList bars={stats.stages} total={stats.total} />
        </Panel>
        <Panel title="재현 판정 분포" description="최근 검증 job의 판정이에요. 재현 안 됨은 버그가 없다는 뜻이 아니에요.">
          <BarList bars={stats.verdict} total={stats.total} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="최근 신고"
          action={
            <Link href="/reports" className="text-xs font-medium text-primary hover:underline">
              전체 보기
            </Link>
          }
        >
          {stats.recent.length === 0 ? (
            <p className="text-sm text-muted">아직 신고가 없어요.</p>
          ) : (
            <ul className="-mx-2 divide-y divide-border">
              {stats.recent.map((report) => (
                <li key={report.id}>
                  <Link
                    href={`/reports/${encodeURIComponent(report.id)}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-3 hover:bg-background"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        <span className="mr-1.5 font-mono text-xs text-muted">BUG-{report.number}</span>
                        {report.title}
                      </span>
                      <span className="block text-xs text-muted">
                        {stats.programNames.get(report.program_id) ?? report.program_id} ·{" "}
                        {new Date(report.created_at).toLocaleString("ko-KR")}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-1.5">
                      <ProgressBadge value={report.progress} />
                      <JobStatusBadge value={report.latest_job?.status} />
                      <VerdictBadge value={report.latest_job?.verdict} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="사이트별 신고">
            {stats.byProgram.length === 0 ? (
              <p className="text-sm text-muted">아직 신고가 없어요.</p>
            ) : (
              <BarList bars={stats.byProgram} total={stats.total} />
            )}
          </Panel>
          <Panel title="AI 분류 현황">
            <p className="text-sm text-muted">-</p>
            <p className="mt-1 text-xs text-muted">백엔드 지원 필요: 신고 목록 응답에 AI 분류가 없어 계산할 수 없어요.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-sm text-muted">{label}</h2>
      <p className="mt-2 text-3xl font-bold">
        {value}
        {unit && value !== "-" && <span className="ml-1 text-base font-medium text-muted">{unit}</span>}
      </p>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </section>
  );
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function BarList({ bars, total }: { bars: Bar[]; total: number }) {
  return (
    <ul className="space-y-3">
      {bars.map((bar) => {
        const percent = total > 0 ? (bar.count / total) * 100 : 0;
        return (
          <li key={bar.key}>
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="truncate">{bar.label}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {bar.count}건 · {Math.round(percent)}%
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-background"
              role="meter"
              aria-label={bar.label}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={bar.count}
            >
              <div className={`h-full rounded-full ${toneBar[bar.tone]}`} style={{ width: `${percent}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** 1시간 미만은 분, 하루 미만은 시간, 그 이상은 일 단위로 보여준다. */
function formatDuration(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}분`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}시간`;
  return `${(hours / 24).toFixed(1)}일`;
}
