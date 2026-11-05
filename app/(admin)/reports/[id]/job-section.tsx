"use client";

import type { Schemas } from "@/lib/api";
import { JobStatusBadge } from "@/components/badge";
import * as labels from "@/lib/labels";
import { isActiveJob, useJobEvents } from "./queries";
import { ErrorText, Field, Fields, Muted, Section, formatDateTime } from "./ui";

const jobKind: Record<string, string> = {
  initial: "최초 검증",
  fresh: "다시 검증",
  resume: "답변 후 재개",
  retest: "재시험",
};

/** 재시험에서 기준 판정과 비교한 결과 */
const regressionLabel: Record<string, string> = {
  resolved_in_test: "테스트 빌드에서 해결됨",
};

export function JobSection({ job, actions }: { job: Schemas["JobOut"]; actions?: React.ReactNode }) {
  const active = isActiveJob(job.status);
  return (
    <Section title="실행 상태" aside={actions}>
      <Fields>
        <Field label="실행 상태">
          <span className="flex flex-wrap items-center gap-2">
            <JobStatusBadge value={job.status} />
            {active && <span className="text-xs text-muted">3초마다 갱신 중</span>}
          </span>
        </Field>
        <Field label="단계">{job.stage ? stageOrStatus(job.stage) : "-"}</Field>
        <Field label="종류">{jobKind[job.kind] ?? job.kind}</Field>
        {job.regression && <Field label="재시험 결과">{regressionLabel[job.regression] ?? job.regression}</Field>}
        <Field label="시작">{formatDateTime(job.started_at)}</Field>
        <Field label="종료">{formatDateTime(job.finished_at)}</Field>
        {job.error_code && (
          <Field label="오류 코드">
            <span className="font-mono text-xs">{job.error_code}</span>
          </Field>
        )}
      </Fields>
      <div className="mt-6 border-t border-border pt-6">
        <h3 className="mb-3 text-sm font-medium">진행 로그</h3>
        <EventLog jobId={job.id} active={active} />
      </div>
    </Section>
  );
}

function EventLog({ jobId, active }: { jobId: string; active: boolean }) {
  const events = useJobEvents(jobId, active);
  if (events.isPending) return <Muted>불러오는 중…</Muted>;
  if (events.isError) return <ErrorText error={events.error} prefix="진행 로그를 불러오지 못했어요." />;
  if (events.data.items.length === 0) return <Muted>아직 기록이 없어요.</Muted>;

  return (
    <ol className="space-y-2 text-sm">
      {events.data.items.map((event) => (
        <li key={event.id} className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="w-40 shrink-0 text-xs text-muted tabular-nums">{formatDateTime(event.created_at)}</span>
          <span className="font-medium">{stageOrStatus(event.kind)}</span>
          <EventDetail detail={event.detail} />
        </li>
      ))}
    </ol>
  );
}

/** 이벤트 kind는 단계 이름이거나, 끝나면 최종 실행 상태다. */
function stageOrStatus(kind: string): string {
  const stage = labels.jobStage(kind);
  if (stage.label !== kind) return stage.label;
  return labels.jobStatus(kind).label;
}

/** detail의 단순 값만 텍스트로 보여준다. */
function EventDetail({ detail }: { detail: Record<string, unknown> }) {
  const entries = Object.entries(detail ?? {}).filter(
    ([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean",
  );
  if (entries.length === 0) return null;
  return (
    <span className="min-w-0 break-words text-muted">
      {entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}
    </span>
  );
}
