"use client";

import Link from "next/link";
import { JobStatusBadge, VerdictBadge, WorkflowBadge } from "@/components/badge";
import { ApiError, type Schemas } from "@/lib/api";
import { AnalysisSection } from "./analysis-section";
import { ClarificationSection } from "./clarification-section";
import { EnvironmentSection } from "./environment-section";
import { CancelJobButton, RetestButton, RevalidateButton } from "./job-actions";
import { JobSection } from "./job-section";
import { OverviewSection } from "./overview-section";
import { isActiveJob, useJob, useJobResult, useReport } from "./queries";
import { ResultSection } from "./result-section";
import { ScenarioSection } from "./scenario-section";
import { ErrorText, Muted, Section } from "./ui";

type Report = Schemas["ReportDetail"];

export function ReportDetail({ reportId }: { reportId: string }) {
  const report = useReport(reportId);

  if (report.isPending) return <Muted>불러오는 중…</Muted>;
  if (report.isError) return <ReportError error={report.error} />;

  const jobId = report.data.latest_job?.id ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Header report={report.data} jobId={jobId} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {jobId && <PendingQuestions reportId={reportId} jobId={jobId} />}
          <OverviewSection report={report.data} />
          {jobId ? (
            <JobPanels reportId={reportId} jobId={jobId} />
          ) : (
            <Section title="검증">
              <Muted>아직 검증 작업이 없어요.</Muted>
            </Section>
          )}
        </div>
        <div className="min-w-0 space-y-6">
          <WorkflowSection status={report.data.workflow_status} />
          <EnvironmentSection report={report.data} />
        </div>
      </div>
    </div>
  );
}

function ReportError({ error }: { error: unknown }) {
  const status = error instanceof ApiError ? error.status : null;
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <BackLink />
      {status === 404 ? (
        <Section title="신고를 찾을 수 없어요">
          <Muted>삭제됐거나 주소가 잘못됐어요.</Muted>
        </Section>
      ) : status === 403 ? (
        <Section title="볼 권한이 없어요">
          <Muted>이 신고가 속한 사이트에 접근 권한이 없어요. 관리자에게 문의하세요.</Muted>
        </Section>
      ) : (
        <ErrorText error={error} prefix="신고를 불러오지 못했어요." />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/reports" className="text-sm text-muted hover:text-foreground">
      ← 신고 목록
    </Link>
  );
}

function Header({ report, jobId }: { report: Report; jobId: string | null }) {
  return (
    <header className="space-y-3">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{report.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
            <span className="flex items-center gap-1">
              처리 <WorkflowBadge value={report.workflow_status} />
            </span>
            {jobId ? (
              <HeaderJobBadges jobId={jobId} reportId={report.id} />
            ) : (
              <span className="flex items-center gap-1">
                실행 <JobStatusBadge value={null} />
              </span>
            )}
          </div>
        </div>
        {jobId ? (
          <HeaderRerun reportId={report.id} programId={report.program_id} jobId={jobId} />
        ) : (
          <RevalidateButton reportId={report.id} />
        )}
      </div>
    </header>
  );
}

/** 처리 상태, 실행 상태, 재현 판정은 항상 따로 보여준다. */
function HeaderJobBadges({ reportId, jobId }: { reportId: string; jobId: string }) {
  const job = useJob(reportId, jobId);
  return (
    <>
      <span className="flex items-center gap-1">
        실행 <JobStatusBadge value={job.data?.status} />
      </span>
      <span className="flex items-center gap-1">
        판정 <VerdictBadge value={job.data?.verdict} />
      </span>
    </>
  );
}

function HeaderRerun({ reportId, programId, jobId }: { reportId: string; programId: string; jobId: string }) {
  const job = useJob(reportId, jobId);
  return (
    <div className="flex flex-wrap items-start justify-end gap-2">
      <RetestButton reportId={reportId} programId={programId} baseline={job.data} />
      <RevalidateButton reportId={reportId} disabled={!job.data || isActiveJob(job.data.status)} />
    </div>
  );
}

function JobPanels({ reportId, jobId }: { reportId: string; jobId: string }) {
  const job = useJob(reportId, jobId);
  const result = useJobResult(jobId);

  if (job.isPending) {
    return (
      <Section title="실행 상태">
        <Muted>불러오는 중…</Muted>
      </Section>
    );
  }
  if (job.isError) {
    return (
      <Section title="실행 상태">
        <ErrorText error={job.error} prefix="검증 작업을 불러오지 못했어요." />
      </Section>
    );
  }

  const active = isActiveJob(job.data.status);
  const resultProps = { result: result.data, resultError: result.error, resultPending: result.isPending };

  return (
    <>
      <JobSection job={job.data} actions={active && <CancelJobButton jobId={jobId} status={job.data.status} />} />
      <ResultSection job={job.data} {...resultProps} />
      <ScenarioSection {...resultProps} />
      <AnalysisSection reportId={reportId} />
    </>
  );
}

/** needs_info면 답변이 다음 할 일이라 개요보다 위에 둔다. */
function PendingQuestions({ reportId, jobId }: { reportId: string; jobId: string }) {
  const job = useJob(reportId, jobId);
  if (job.data?.status !== "needs_info" || job.data.questions.length === 0) return null;
  return <ClarificationSection reportId={reportId} jobId={jobId} questions={job.data.questions} />;
}

function WorkflowSection({ status }: { status: string }) {
  return (
    <Section title="처리 상태">
      <WorkflowBadge value={status} />
      <p className="mt-3 text-xs text-muted">처리 상태 변경은 백엔드 지원 후 제공돼요.</p>
    </Section>
  );
}
