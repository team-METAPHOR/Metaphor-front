"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card, button } from "@/components/ui";
import type { Schemas } from "@/lib/api";
import * as labels from "@/lib/labels";
import { isActiveJob, useReportJobs } from "./queries";
import { ErrorText, formatTime, secondsBetween } from "./ui";

type Job = Schemas["JobOut"];

/** 화면에 띄울 실행을 고르는 주소 파라미터. 없으면 최신 실행이다. */
export const RUN_PARAM = "run";

const KIND_LABELS: Record<string, string> = {
  initial: "첫 재현",
  fresh: "다시 재현",
  resume: "이어서 재현",
  retest: "수정 확인",
};

export function runKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

/** 같은 신고 주소에 고른 실행만 붙인다. null이면 최신 실행(파라미터 없음). */
function runHref(pathname: string, jobId: string | null): string {
  return jobId ? `${pathname}?${new URLSearchParams({ [RUN_PARAM]: jobId })}` : pathname;
}

type Outcome = { text: string; className: string };

/** 실행 한 건의 결과 한 단어. 수정 확인은 재현되지 않아야 통과다. */
function outcomeOf(job: Job): Outcome {
  if (job.status === "completed" && job.kind === "retest") {
    return job.verdict === "not_reproduced"
      ? { text: "통과", className: "text-primary-ink" }
      : { text: "통과 못 함", className: "text-danger" };
  }
  if (job.status === "completed" && job.verdict) {
    const className =
      job.verdict === "reproduced" ? "text-primary-ink" : job.verdict === "inconclusive" ? "text-warning-ink" : "text-subtle";
    return { text: labels.verdict(job.verdict).label, className };
  }
  const tone = labels.jobStatus(job.status).tone;
  const className =
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning-ink" : tone === "progress" ? "text-info" : "text-muted";
  return { text: labels.jobStatus(job.status).label, className };
}

/** "11/5 14:27". 이력은 짧게 쓴다. */
function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.getMonth() + 1}/${date.getDate()} ${formatTime(value)}`;
}

/** "3분 05초", 1분 안이면 "42초" */
function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes}분 ${String(rest).padStart(2, "0")}초` : `${rest}초`;
}

/** 이 신고에서 돌린 모든 실행. 누르면 그 실행의 결과로 화면을 바꾼다. */
export function RunHistoryCard({ reportId, shownId, latestId }: { reportId: string; shownId: string; latestId: string }) {
  const pathname = usePathname();
  const jobs = useReportJobs(reportId);
  const items = jobs.data?.items ?? [];

  return (
    <Card
      title="실행 이력"
      description={items.length > 0 ? `${items.length}번 실행했어요. 누르면 그때 결과를 봐요.` : undefined}
    >
      {jobs.isError && <ErrorText error={jobs.error} prefix="실행 이력을 불러오지 못했어요." />}
      {jobs.isPending && <div className="h-28 animate-pulse rounded-lg bg-surface-inset" aria-busy="true" />}
      {items.length > 0 && (
        <ol className="-mx-3 -mt-1 flex flex-col gap-1">
          {items.map((job) => {
            const shown = job.id === shownId;
            const latest = job.id === latestId;
            const outcome = outcomeOf(job);
            const duration = isActiveJob(job.status) ? null : formatDuration(secondsBetween(job.started_at, job.finished_at));
            return (
              <li key={job.id}>
                <Link
                  href={runHref(pathname, latest ? null : job.id)}
                  replace
                  scroll={false}
                  aria-current={shown ? "true" : undefined}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition ${
                    shown ? "bg-chip" : "hover:bg-chip/60"
                  }`}
                >
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="flex items-center gap-1.5">
                      <span className={`text-sm ${shown ? "font-semibold" : "font-medium"}`}>{runKindLabel(job.kind)}</span>
                      {latest && (
                        <span className="rounded bg-chip px-1.5 py-0.5 text-[11px] font-medium text-label">최신</span>
                      )}
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      {formatWhen(job.created_at)}
                      {duration && ` · ${duration}`}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[13px] font-semibold ${outcome.className}`}>{outcome.text}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/** 최신이 아닌 실행을 보고 있을 때 본문 위에 띄운다. */
export function OlderRunBanner({ shown, latest }: { shown: Job; latest: { kind: string } | null }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-edge bg-surface py-3.5 pr-3.5 pl-[18px]">
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-[15px] font-semibold">
          {formatWhen(shown.created_at)} {runKindLabel(shown.kind)} 결과를 보고 있어요
        </span>
        <span className="text-[13px] text-subtle">
          {latest ? `최신 실행은 ${runKindLabel(latest.kind)}이에요. ` : ""}아래 카드는 이 실행 기준이에요.
        </span>
      </div>
      <Link href={runHref(pathname, null)} replace scroll={false} className={button.ghost}>
        최신 실행 보기
      </Link>
    </div>
  );
}
