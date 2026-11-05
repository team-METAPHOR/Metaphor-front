"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProgressBadge } from "@/components/badge";
import { ApiError, api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import * as labels from "@/lib/labels";
import { SETTABLE_WORKFLOW_STATUSES } from "@/types/report";
import { orgKeys } from "../../org/ui";
import { reportKeys } from "./queries";
import { ErrorText, Field, Fields, Muted, Section, formatDateTime } from "./ui";

type Report = Schemas["ReportDetail"];
type Member = Schemas["MemberResponse"];

/** 대시보드 5단계. triaged(재현 안 됨)도 "재현 완료" 단계다. */
const STAGES = [
  { key: "new", label: "신규 신고" },
  { key: "reproducing", label: "재현 중" },
  { key: "reproduced", label: "재현 완료" },
  { key: "fixing", label: "버그 수정 중" },
  { key: "closed", label: "마감" },
] as const;

function stageIndex(progress: string): number {
  const key = progress === "triaged" ? "reproduced" : progress;
  return STAGES.findIndex((stage) => stage.key === key);
}

const workflowErrors: Record<string, string> = {
  REPORT_CLOSED: "마감된 신고는 처리 상태를 바꿀 수 없어요.",
  ASSIGNEE_NOT_MEMBER: "이 조직의 활성 멤버만 담당자로 지정할 수 있어요.",
};

function WorkflowError({ error, prefix }: { error: unknown; prefix: string }) {
  const message = error instanceof ApiError ? workflowErrors[error.code] : undefined;
  if (message) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {message}
      </p>
    );
  }
  return <ErrorText error={error} prefix={prefix} />;
}

/** 진행 단계, 처리 상태 변경, 담당자 지정. 변경은 reviewer, admin만 할 수 있다. */
export function WorkflowSection({ report }: { report: Report }) {
  const { canReview, membership } = useSession();
  const client = useQueryClient();

  function applyUpdate(updated: Report) {
    client.setQueryData(reportKeys.report(report.id), updated);
    // 목록과 대시보드는 진행 단계, 담당자를 보여주므로 다시 받는다.
    void client.invalidateQueries({ queryKey: ["reports"] });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const workflow = useMutation({
    mutationFn: (status: string) =>
      api<Report>(`/reports/${encodeURIComponent(report.id)}/workflow`, { method: "PATCH", body: { status } }),
    onSuccess: applyUpdate,
  });
  const assign = useMutation({
    mutationFn: (userId: string | null) =>
      api<Report>(`/reports/${encodeURIComponent(report.id)}/assignee`, { method: "PATCH", body: { user_id: userId } }),
    onSuccess: applyUpdate,
  });

  const closed = report.workflow_status === "closed";
  const dismissed = report.progress === "dismissed";

  return (
    <Section title="처리">
      <ProgressSteps progress={report.progress} />
      {dismissed && <p className="mt-2 text-xs text-muted">버그 아님·중복으로 종료된 신고예요.</p>}

      <div className="mt-5 border-t border-border pt-5">
        <Fields stacked>
          <Field label="처리 상태">
            {canReview && !closed ? (
              <select
                aria-label="처리 상태"
                value={report.workflow_status}
                disabled={workflow.isPending}
                onChange={(event) => workflow.mutate(event.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                {SETTABLE_WORKFLOW_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {labels.workflowStatus(status).label}
                  </option>
                ))}
              </select>
            ) : (
              labels.workflowStatus(report.workflow_status).label
            )}
          </Field>
          {closed ? (
            <Field label="마감 시각">{formatDateTime(report.closed_at)}</Field>
          ) : (
            <Field label="마감">
              <span className="text-xs text-muted">재시험에서 재현되지 않으면 자동으로 마감돼요.</span>
            </Field>
          )}
          <Field label="담당자">
            {canReview ? (
              <AssigneeSelect
                // 신고 응답에 조직 id가 없어 현재 조직의 멤버를 쓴다(신고 목록도 현재 조직 기준).
                orgId={membership.org_id}
                assignee={report.assignee}
                disabled={assign.isPending}
                onChange={(userId) => assign.mutate(userId)}
              />
            ) : (
              <AssigneeText assignee={report.assignee} />
            )}
          </Field>
        </Fields>
        {workflow.error && <WorkflowError error={workflow.error} prefix="처리 상태를 바꾸지 못했어요." />}
        {assign.error && <WorkflowError error={assign.error} prefix="담당자를 바꾸지 못했어요." />}
      </div>
    </Section>
  );
}

function ProgressSteps({ progress }: { progress: string }) {
  const current = stageIndex(progress);
  if (current < 0) return <ProgressBadge value={progress} />;
  return (
    <ol className="flex flex-col gap-1.5 text-sm">
      {STAGES.map((stage, index) => {
        const state = index < current ? "done" : index === current ? "current" : "todo";
        return (
          <li key={stage.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                state === "todo" ? "border border-border" : state === "current" ? "bg-primary" : "bg-primary/40"
              }`}
            />
            <span className={state === "current" ? "font-semibold" : state === "todo" ? "text-muted" : undefined}>
              {index === current && progress === "triaged" ? "재현 완료(재현 안 됨)" : stage.label}
            </span>
            {state === "current" && <span className="sr-only">(현재 단계)</span>}
          </li>
        );
      })}
    </ol>
  );
}

function AssigneeText({ assignee }: { assignee: Report["assignee"] }) {
  if (!assignee) return <span className="text-muted">없음</span>;
  if (!assignee.active) return <span className="text-muted">(나간 멤버)</span>;
  return <span>{assignee.display_name ?? assignee.email}</span>;
}

function AssigneeSelect({
  orgId,
  assignee,
  disabled,
  onChange,
}: {
  orgId: string;
  assignee: Report["assignee"];
  disabled: boolean;
  onChange: (userId: string | null) => void;
}) {
  const members = useQuery({
    queryKey: orgKeys.members(orgId),
    queryFn: () => api<Member[]>(`/orgs/${encodeURIComponent(orgId)}/members`),
  });

  if (members.isPending) return <Muted>멤버를 불러오는 중…</Muted>;
  if (members.isError) return <ErrorText error={members.error} prefix="멤버 목록을 불러오지 못했어요." />;

  const active = members.data.filter((member) => member.is_active);
  // 지금 담당자가 목록에 없으면(나간 멤버) 선택지로 남겨 현재 값을 보여준다.
  const current = assignee?.id ?? "";
  const missing = assignee && !active.some((member) => member.user_id === assignee.id);

  return (
    <select
      aria-label="담당자"
      value={current}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
    >
      <option value="">없음</option>
      {missing && (
        <option value={assignee.id} disabled>
          {assignee.active ? (assignee.display_name ?? assignee.email) : "(나간 멤버)"}
        </option>
      )}
      {active.map((member) => (
        <option key={member.user_id} value={member.user_id}>
          {member.display_name ? `${member.display_name} (${member.email})` : member.email}
        </option>
      ))}
    </select>
  );
}
