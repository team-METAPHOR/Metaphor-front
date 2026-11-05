"use client";

import Link from "next/link";
import { Card, Icon, StatusBadge } from "@/components/ui";
import { ApiError, type Schemas } from "@/lib/api";
import { AssignmentCard } from "./assignment-card";
import { EvidenceCard, LogEstimateCard } from "./evidence";
import { CancelJobButton, RevalidateButton } from "./job-actions";
import { NeedsCard } from "./needs-card";
import { isActiveJob, useJob, useJobResult, useReport } from "./queries";
import { RetestCard } from "./retest-card";
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
import { ErrorText, Muted } from "./ui";

type Report = Schemas["ReportDetail"];
type Job = Schemas["JobOut"];

const NOT_REPRODUCED_VERDICTS = ["not_reproduced", "inconclusive"];

export function ReportDetail({ reportId }: { reportId: string }) {
  const report = useReport(reportId);

  if (report.isPending) return <DetailSkeleton />;
  if (report.isError) return <ReportError error={report.error} />;

  const latest = report.data.latest_job;
  if (!latest) return <Body report={report.data} repro={null} retest={null} />;
  return <WithLatestJob report={report.data} jobId={latest.id} />;
}

/** 최근 실행이 수정 확인(retest)이면, 화면은 그 기준이 된 재현 실행을 중심으로 그린다. */
function WithLatestJob({ report, jobId }: { report: Report; jobId: string }) {
  const job = useJob(report.id, jobId);
  if (job.isPending) return <DetailSkeleton />;
  if (job.isError) return <ErrorText error={job.error} prefix="재현 실행을 불러오지 못했어요." />;
  if (job.data.kind === "retest" && job.data.baseline_job_id) {
    return <WithBaseline report={report} baselineId={job.data.baseline_job_id} retest={job.data} />;
  }
  return <Body report={report} repro={job.data} retest={null} />;
}

function WithBaseline({ report, baselineId, retest }: { report: Report; baselineId: string; retest: Job }) {
  const baseline = useJob(report.id, baselineId);
  if (baseline.isPending) return <DetailSkeleton />;
  if (baseline.isError) return <ErrorText error={baseline.error} prefix="재현 실행을 불러오지 못했어요." />;
  return <Body report={report} repro={baseline.data} retest={retest} />;
}

type Variant = "reproduced" | "not-reproduced" | "pending";

function variantOf(job: Job | null): Variant {
  if (!job || isActiveJob(job.status)) return "pending";
  if (job.verdict === "reproduced") return "reproduced";
  if (job.status === "needs_info") return "not-reproduced";
  if (job.status === "completed" && job.verdict != null && NOT_REPRODUCED_VERDICTS.includes(job.verdict)) {
    return "not-reproduced";
  }
  return "pending";
}

function Body({ report, repro, retest }: { report: Report; repro: Job | null; retest: Job | null }) {
  const variant = variantOf(repro);
  // 지금 돌고 있거나 가장 최근인 실행. 취소 버튼은 이 실행에 붙는다.
  const current = retest ?? repro;

  return (
    <div className="flex flex-col gap-8">
      <Header report={report} current={current} variant={variant} />
      {repro && variant !== "pending" ? (
        <JobLayout report={report} repro={repro} retest={retest} variant={variant} />
      ) : (
        <PendingLayout report={report} job={repro} />
      )}
    </div>
  );
}

function Header({ report, current, variant }: { report: Report; current: Job | null; variant: Variant }) {
  const stage = stageIndex(report.progress);
  const active = current != null && isActiveJob(current.status);
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
              primary={variant === "not-reproduced" || !current}
              disabled={active}
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
}: {
  report: Report;
  repro: Job;
  retest: Job | null;
  variant: Exclude<Variant, "pending">;
}) {
  const result = useJobResult(repro.id);
  const steps = result.data?.report?.scenario?.steps ?? [];
  const attempts = result.data?.report?.run?.evidence ?? [];
  const resultError = result.isError && (
    <ErrorText error={result.error} prefix="재현 결과를 불러오지 못했어요." />
  );

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
            <ScreenshotsCard jobId={repro.id} />
            <SolutionsCard reportId={report.id} />
            <RetestCard reportId={report.id} programId={report.program_id} baseline={repro} retest={retest} />
          </>
        }
        side={
          <>
            <ProgressCard report={report} job={repro} />
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
          <NeedsCard reportId={report.id} programId={report.program_id} job={repro} />
          {resultError}
          <AttemptsCard attempts={attempts} stepCount={steps.length} reproduced={false} />
          <ClosestPlanCard reportId={report.id} attempts={attempts} />
        </>
      }
      side={
        <>
          <EvidenceCard report={report} compact />
          <LogEstimateCard report={report} />
          <AssignmentCard report={report} />
        </>
      }
    />
  );
}

function PendingLayout({ report, job }: { report: Report; job: Job | null }) {
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
