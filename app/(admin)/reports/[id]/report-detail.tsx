"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, Icon, StatusBadge } from "@/components/ui";
import { ApiError, type Schemas } from "@/lib/api";
import { AssignmentCard } from "./assignment-card";
import { DiagnosisCard } from "./diagnosis-card";
import { EvidenceCard, LogEstimateCard } from "./evidence";
import { CancelJobButton, RevalidateButton } from "./job-actions";
import { TestExportCard, VideoCard } from "./media-cards";
import { NeedsCard } from "./needs-card";
import { isActiveJob, isResultExpired, useJob, useJobResult, useReport } from "./queries";
import { RetestCard } from "./retest-card";
import { OlderRunBanner, RUN_PARAM, RunHistoryCard } from "./run-history";
import {
  AttemptsCard,
  ClosestPlanCard,
  LikelyConditionCard,
  ProgressCard,
  ScreenshotsCard,
  SolutionsCard,
  StepsCard,
  TimelineCard,
  stageIndex,
} from "./run-cards";
import { STOPPED_JOB_STATUSES, StopCard, useReached } from "./stop-card";
import { ErrorText, Muted } from "./ui";

type Report = Schemas["ReportDetail"];
type Job = Schemas["JobOut"];
type JobBrief = Schemas["JobBrief"];

/** 실행 이력에서 고른 실행과 최신 실행. 이력 카드와 "이전 실행 보는 중" 안내에 쓴다. */
type Runs = { shown: Job; latest: JobBrief };

const NOT_REPRODUCED_VERDICTS = ["not_reproduced", "inconclusive"];

export function ReportDetail({ reportId }: { reportId: string }) {
  const report = useReport(reportId);
  const runParam = useSearchParams().get(RUN_PARAM);

  if (report.isPending) return <DetailSkeleton />;
  if (report.isError) return <ReportError error={report.error} />;

  const latest = report.data.latest_job;
  if (!latest) return <Body report={report.data} repro={null} retest={null} />;
  // ?run=<id>로 이력의 실행을 고른다. 없으면 최신 실행.
  return <WithJob report={report.data} jobId={runParam ?? latest.id} latest={latest} />;
}

/** 고른 실행이 수정 확인(retest)이면, 화면은 그 기준이 된 재현 실행을 중심으로 그린다. */
function WithJob({ report, jobId, latest }: { report: Report; jobId: string; latest: JobBrief }) {
  const job = useJob(report.id, jobId);
  if (job.isPending) return <DetailSkeleton />;
  if (job.isError) return <ErrorText error={job.error} prefix="재현 실행을 불러오지 못했어요." />;
  const runs = { shown: job.data, latest };
  if (job.data.kind === "retest" && job.data.baseline_job_id) {
    return <WithBaseline report={report} baselineId={job.data.baseline_job_id} retest={job.data} runs={runs} />;
  }
  return <Body report={report} repro={job.data} retest={null} runs={runs} />;
}

function WithBaseline({ report, baselineId, retest, runs }: { report: Report; baselineId: string; retest: Job; runs: Runs }) {
  const baseline = useJob(report.id, baselineId);
  if (baseline.isPending) return <DetailSkeleton />;
  if (baseline.isError) return <ErrorText error={baseline.error} prefix="재현 실행을 불러오지 못했어요." />;
  return <Body report={report} repro={baseline.data} retest={retest} runs={runs} />;
}

type Variant = "reproduced" | "not-reproduced" | "stopped" | "pending";

function variantOf(job: Job | null): Variant {
  if (!job || isActiveJob(job.status)) return "pending";
  if (job.verdict === "reproduced") return "reproduced";
  if (STOPPED_JOB_STATUSES.includes(job.status)) return "stopped";
  if (job.status === "needs_info") return "not-reproduced";
  if (job.status === "completed" && job.verdict != null && NOT_REPRODUCED_VERDICTS.includes(job.verdict)) {
    return "not-reproduced";
  }
  return "pending";
}

function Body({
  report,
  repro,
  retest,
  runs,
}: {
  report: Report;
  repro: Job | null;
  retest: Job | null;
  runs?: Runs;
}) {
  const variant = variantOf(repro);
  // 지금 돌고 있거나 가장 최근인 실행. 취소 버튼은 이 실행에 붙는다.
  const current = retest ?? repro;
  const older = runs && runs.shown.id !== runs.latest.id;
  const history = runs && <RunHistoryCard reportId={report.id} shownId={runs.shown.id} latestId={runs.latest.id} />;

  return (
    <div className="flex flex-col gap-8">
      <Header report={report} current={current} variant={variant} />
      <div className="flex flex-col gap-5">
        {older && <OlderRunBanner shown={runs.shown} latest={runs.latest} />}
        {repro && variant === "stopped" ? (
          <StoppedLayout report={report} job={repro} history={history} />
        ) : repro && (variant === "reproduced" || variant === "not-reproduced") ? (
          <JobLayout report={report} repro={repro} retest={retest} variant={variant} history={history} older={!!older} />
        ) : (
          <PendingLayout report={report} job={repro} history={history} />
        )}
      </div>
    </div>
  );
}

function Header({ report, current, variant }: { report: Report; current: Job | null; variant: Variant }) {
  const stage = stageIndex(report.progress);
  const active = current != null && isActiveJob(current.status);
  // AI 사용량 제한으로 멈췄으면 서버가 정한 시각까지 다시 실행을 받지 않는다(429).
  const retryReady = useReached(current?.retry_available_at);
  return (
    <header className="flex flex-col gap-4">
      <nav aria-label="위치" className="flex items-center gap-1.5 text-[13px] text-muted">
        <Link href="/reports" className="hover:text-foreground">
          제보 목록
        </Link>
        <Icon name="chevron-right-sm" size={14} />
        <span className="font-mono text-subtle">BUG-{report.number}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-muted">
            <StatusBadge progress={report.progress} />
            <span className="font-mono">BUG-{report.number}</span>
            {stage >= 0 && <span>5단계 중 {stage + 1}단계</span>}
          </div>
          <h1 className="text-[26px] leading-[34px] font-semibold break-words">{report.title}</h1>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          {active && current && <CancelJobButton jobId={current.id} status={current.status} />}
          {report.workflow_status !== "closed" && (
            <RevalidateButton
              reportId={report.id}
              label={variant === "pending" && !current ? "재현 시작" : "처음부터 다시 재현"}
              primary={variant === "not-reproduced" || variant === "stopped" || !current}
              disabled={active || !retryReady}
            />
          )}
        </div>
      </div>
    </header>
  );
}

function Columns({ main, side }: { main: React.ReactNode; side: React.ReactNode }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">{main}</div>
      <div className="flex min-w-0 flex-col gap-5">{side}</div>
    </div>
  );
}

function JobLayout({
  report,
  repro,
  retest,
  variant,
  history,
  older,
}: {
  report: Report;
  repro: Job;
  retest: Job | null;
  variant: Exclude<Variant, "pending" | "stopped">;
  history: React.ReactNode;
  /** 이력에서 고른 지난 실행. 그 실행의 질문에 답하면 지금 흐름과 엇갈리므로 답변 칸을 숨긴다. */
  older: boolean;
}) {
  const result = useJobResult(repro.id);
  const steps = result.data?.report?.scenario?.steps ?? [];
  const attempts = result.data?.report?.run?.evidence ?? [];
  const resultError =
    result.isError &&
    (isResultExpired(result.error) ? (
      <Card title="결과 보존 기간이 지났어요" description="보관 기간이 끝나 재현 결과와 증거가 삭제됐어요." />
    ) : (
      <ErrorText error={result.error} prefix="재현 결과를 불러오지 못했어요." />
    ));

  if (variant === "reproduced") {
    return (
      <Columns
        main={
          <>
            <EvidenceCard report={report} />
            <TimelineCard report={report} job={repro} attempts={attempts.length} />
            {resultError}
            <AttemptsCard attempts={attempts} stepCount={steps.length} reproduced />
            {steps.length > 0 && <StepsCard report={report} jobId={repro.id} steps={steps} />}
            <TestExportCard jobId={repro.id} />
            <VideoCard jobId={repro.id} />
            <ScreenshotsCard jobId={repro.id} />
            <SolutionsCard reportId={report.id} />
            <RetestCard reportId={report.id} programId={report.program_id} baseline={repro} retest={retest} />
          </>
        }
        side={
          <>
            <ProgressCard report={report} job={repro} />
            {history}
            <LikelyConditionCard reportNumber={report.number} job={repro} steps={steps} />
            <AssignmentCard report={report} />
          </>
        }
      />
    );
  }

  return (
    <Columns
      main={
        <>
          {!older && <NeedsCard reportId={report.id} programId={report.program_id} job={repro} />}
          <DiagnosisCard reportId={report.id} jobId={repro.id} />
          {resultError}
          <AttemptsCard attempts={attempts} stepCount={steps.length} reproduced={false} />
          <VideoCard jobId={repro.id} />
          <ClosestPlanCard reportId={report.id} attempts={attempts} />
        </>
      }
      side={
        <>
          <EvidenceCard report={report} compact />
          <LogEstimateCard report={report} />
          {history}
          <AssignmentCard report={report} />
        </>
      }
    />
  );
}

function StoppedLayout({ report, job, history }: { report: Report; job: Job; history: React.ReactNode }) {
  return (
    <Columns
      main={
        <>
          <StopCard report={report} job={job} />
          <DiagnosisCard reportId={report.id} jobId={job.id} />
        </>
      }
      side={
        <>
          <EvidenceCard report={report} compact />
          <LogEstimateCard report={report} />
          {history}
          <AssignmentCard report={report} />
        </>
      }
    />
  );
}

function PendingLayout({ report, job, history }: { report: Report; job: Job | null; history: React.ReactNode }) {
  return (
    <Columns
      main={
        <>
          <EvidenceCard report={report} />
          {job ? (
            <TimelineCard report={report} job={job} attempts={0} />
          ) : (
            <Card title="자동 재현" description="아직 재현을 시작하지 않았어요. 위의 ‘재현 시작’으로 실제 브라우저에서 확인할 수 있어요." />
          )}
        </>
      }
      side={
        <>
          <ProgressCard report={report} job={job ?? undefined} />
          {history}
          <AssignmentCard report={report} />
        </>
      }
    />
  );
}

function ReportError({ error }: { error: unknown }) {
  const status = error instanceof ApiError ? error.status : null;
  return (
    <div className="flex flex-col gap-6">
      <Link href="/reports" className="text-[13px] text-muted hover:text-foreground">
        ← 제보 목록
      </Link>
      {status === 404 ? (
        <Card title="제보를 찾을 수 없어요" description="삭제됐거나 주소가 잘못됐어요." />
      ) : status === 403 ? (
        <Card
          title="볼 권한이 없어요"
          description="이 제보가 속한 사이트에 접근 권한이 없어요. 관리자에게 문의하세요."
        />
      ) : (
        <ErrorText error={error} prefix="제보를 불러오지 못했어요." />
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <span className="sr-only">
        <Muted>불러오는 중…</Muted>
      </span>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-40 animate-pulse rounded bg-surface" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-surface" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-80 animate-pulse rounded-xl bg-surface" />
        <div className="h-60 animate-pulse rounded-xl bg-surface" />
      </div>
    </div>
  );
}
