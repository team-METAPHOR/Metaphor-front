"use client";

import Link from "next/link";
import { Icon } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { MAX_REPORTS, type Report, needsInfo, reportCount, useAllReports } from "../reports/all-reports";
import { STATUS_CARDS, computeStats } from "./stats";

export function DashboardView() {
  const reports = useAllReports();

  if (reports.isPending) return <DashboardSkeleton />;
  if (reports.isError) {
    const error = reports.error;
    const detail = error instanceof ApiError && error.requestId ? ` (요청 ID: ${error.requestId})` : "";
    return (
      <p role="alert" className="text-sm text-danger">
        제보를 불러오지 못했어요. {error.message}
        {detail}
      </p>
    );
  }

  const stats = computeStats(reports.data.items);
  const rate = stats.autoReproductionRate;

  return (
    <div className="flex flex-col gap-10">
      {reports.data.truncated && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-ink">
          제보가 많아 최근 {MAX_REPORTS.toLocaleString("ko-KR")}건까지만 계산했어요.
        </p>
      )}

      <Block title="확인할 제보">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {STATUS_CARDS.map((card) => (
            <Link
              key={card.progress}
              href={`/reports?status=${card.progress}`}
              className="transition hover:brightness-125"
            >
              <MetricCard label={card.label}>
                <span className="text-5xl font-semibold text-foreground">{stats.count(card.progress)}</span>
              </MetricCard>
            </Link>
          ))}
        </div>
      </Block>

      <Block title="현재 확인 사항">
        <div className="flex flex-col gap-4 rounded-xl border border-edge bg-surface px-3 py-5">
          {stats.attention.length === 0 ? (
            <p className="px-3 py-2.5 text-lg text-subtle">지금 확인할 제보가 없어요.</p>
          ) : (
            stats.attention.map((report) => <AttentionRow key={report.id} report={report} />)
          )}
        </div>
      </Block>

      <Block
        title={
          <>
            현황 <span className="text-xl font-medium">(이번 주)</span>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="자동 재현율">
            {rate === null ? (
              <Empty note="이번 주 판정된 제보가 없어요" />
            ) : (
              <Accent value={String(Math.round(rate * 100))} unit="%" />
            )}
          </MetricCard>
          <MetricCard label="평균 재현 소요">
            {/* 실행 시간이 목록 응답에 없어 계산할 수 없다(Metaphor-back#59). */}
            <Empty note="집계 기능 준비 중" />
          </MetricCard>
          <MetricCard label="수정 확인 완료">
            <Accent value={String(stats.fixVerified)} unit="건" />
          </MetricCard>
        </div>
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <h2 className="text-[28px] font-semibold tracking-[-0.04em]">{title}</h2>
      {children}
    </section>
  );
}

function MetricCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-40 flex-col justify-between rounded-xl border border-edge bg-surface px-6 py-4">
      <span className="text-xl font-medium text-body">{label}</span>
      <span className="border-t-2 border-line" aria-hidden />
      <span className="leading-none">{children}</span>
    </div>
  );
}

function Accent({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="font-bold tracking-[-0.04em] text-primary-ink">
      <span className="text-5xl">{value}</span>
      <span className="text-[40px]">{unit}</span>
    </span>
  );
}

function Empty({ note }: { note: string }) {
  return (
    <span className="flex items-baseline gap-3">
      <span className="text-5xl font-bold text-faint">-</span>
      <span className="text-sm text-muted">{note}</span>
    </span>
  );
}

function AttentionRow({ report }: { report: Report }) {
  const reproduced = report.progress === "reproduced";
  const badge = reproduced ? "재현됨" : needsInfo(report) ? "정보 부족" : "재현 안 됨";
  const note = reproduced
    ? null
    : needsInfo(report)
      ? "재현에 필요한 정보가 있어요. 질문에 답하면 다시 시도해요."
      : "재현되지 않았어요. 필요한 정보를 확인하세요.";

  return (
    <Link
      href={`/reports/${encodeURIComponent(report.id)}`}
      className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 hover:bg-chip/60"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={`inline-flex w-[78px] shrink-0 justify-center rounded-lg px-2.5 py-1.5 text-base leading-none font-bold text-surface ${
            reproduced ? "bg-primary" : "bg-warning"
          }`}
        >
          {badge}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-lg font-medium">{report.title || "(제목 없음)"}</span>
          {note && <span className="truncate text-xs text-body">{note}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5 text-lg text-label">
        제보 {reportCount(report)}건
        <Icon name="arrow-right" size={20} className="h-5 w-2.5" />
      </span>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-10" aria-busy="true" aria-label="대시보드를 불러오는 중">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-40 rounded-xl bg-surface" />
        ))}
      </div>
      <div className="h-56 rounded-xl bg-surface" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-40 rounded-xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
