"use client";

import Link from "next/link";
import { Icon, formatClock } from "@/components/ui";
import { ApiError, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { requiredAction } from "@/lib/labels";
import { STATUS_CARDS, useReportSummary, useWeeklyStats } from "./stats";

type AttentionItem = Schemas["AttentionItem"];

export function DashboardView() {
  const { membership } = useSession();
  const summary = useReportSummary(membership.org_id);
  const weekly = useWeeklyStats(membership.org_id);

  if (summary.isPending) return <DashboardSkeleton />;
  if (summary.isError) return <LoadError error={summary.error} />;

  const counts = summary.data.counts;
  const stats = weekly.data;

  return (
    <div className="flex flex-col gap-10">
      <Block title="확인할 제보">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {STATUS_CARDS.map((card) => (
            <Link
              key={card.progress}
              href={`/reports?status=${card.progress}`}
              className="transition hover:brightness-125"
            >
              <MetricCard label={card.label}>
                <span className="text-5xl font-semibold text-foreground">{counts[card.progress] ?? 0}</span>
              </MetricCard>
            </Link>
          ))}
        </div>
      </Block>

      <Block title="현재 확인 사항">
        <div className="flex flex-col gap-4 rounded-xl border border-edge bg-surface px-3 py-5">
          {summary.data.needs_attention.length === 0 ? (
            <p className="px-3 py-2.5 text-lg text-subtle">지금 확인할 제보가 없어요.</p>
          ) : (
            summary.data.needs_attention.map((item) => <AttentionRow key={item.id} item={item} />)
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
        {weekly.isError ? (
          <LoadError error={weekly.error} what="이번 주 현황을" />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="자동 재현율">
              {!stats ? (
                <Empty note="불러오는 중…" />
              ) : stats.auto_reproduction_rate === null ? (
                <Empty note="이번 주 판정된 제보가 없어요" />
              ) : (
                <Accent value={String(Math.round(stats.auto_reproduction_rate * 100))} unit="%" />
              )}
            </MetricCard>
            <MetricCard label="평균 재현 소요">
              {!stats ? (
                <Empty note="불러오는 중…" />
              ) : stats.avg_reproduction_seconds === null ? (
                <Empty note="이번 주 끝난 재현이 없어요" />
              ) : (
                <Accent value={formatClock(stats.avg_reproduction_seconds)} unit="" />
              )}
            </MetricCard>
            <MetricCard label="수정 확인 완료">
              {!stats ? <Empty note="불러오는 중…" /> : <Accent value={String(stats.fix_verified_count)} unit="건" />}
            </MetricCard>
          </div>
        )}
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
      <span className="text-[42px]">{value}</span>
      <span className="text-[34px]">{unit}</span>
    </span>
  );
}

function Empty({ note }: { note: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="text-[42px] font-bold text-faint">-</span>
      <span className="text-sm text-muted">{note}</span>
    </span>
  );
}

/** what은 조사까지 넣어 받는다(예: "대시보드를"). */
function LoadError({ error, what = "대시보드를" }: { error: Error; what?: string }) {
  const detail = error instanceof ApiError && error.requestId ? ` (요청 ID: ${error.requestId})` : "";
  return (
    <p role="alert" className="text-sm text-danger">
      {what} 불러오지 못했어요. {error.message}
      {detail}
    </p>
  );
}

/** 서버가 고른 확인할 제보: 재현됨, 한도 대기, 필요 조치가 붙은 제보. */
function AttentionRow({ item }: { item: AttentionItem }) {
  const reproduced = item.progress === "reproduced";
  const badge = reproduced ? "재현됨" : item.progress === "waiting_quota" ? "한도 대기" : "조치 필요";
  const note = item.reason
    ? requiredAction(item.reason)
    : item.progress === "waiting_quota"
      ? "일일 재현 한도를 넘어 대기 중이에요. 다시 재현하면 시작돼요."
      : null;

  return (
    <Link
      href={`/reports/${encodeURIComponent(item.id)}`}
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
          <span className="truncate text-lg font-medium">{item.title || "(제목 없음)"}</span>
          {note && <span className="truncate text-xs text-body">{note}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5 font-mono text-base text-label">
        BUG-{item.number}
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
