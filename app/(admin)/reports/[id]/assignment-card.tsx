"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Card, Icon } from "@/components/ui";
import { ApiError, api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import * as labels from "@/lib/labels";
import { SETTABLE_WORKFLOW_STATUSES } from "@/types/report";
import { orgKeys } from "../../org/ui";
import { reportKeys } from "./queries";
import { ErrorText, Labeled } from "./ui";

type Report = Schemas["ReportDetail"];
type Member = Schemas["MemberResponse"];

const workflowErrors: Record<string, string> = {
  REPORT_CLOSED: "마감된 신고는 처리 상태를 바꿀 수 없어요.",
  ASSIGNEE_NOT_MEMBER: "이 조직의 활성 멤버만 담당자로 지정할 수 있어요.",
};

function WorkflowError({ error, prefix }: { error: unknown; prefix: string }) {
  const message = error instanceof ApiError ? workflowErrors[error.code] : undefined;
  if (message) {
    return (
      <p role="alert" className="text-sm text-danger">
        {message}
      </p>
    );
  }
  return <ErrorText error={error} prefix={prefix} />;
}

const selectClass =
  "w-full cursor-pointer appearance-none rounded-lg border border-border bg-background py-[11px] pr-10 pl-3.5 text-[15px] font-medium outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60";

function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <div className="relative">
      <select aria-label={label} className={selectClass} {...props}>
        {children}
      </select>
      <Icon name="select-chevron" size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
    </div>
  );
}

/** 담당자와 처리 상태. 변경은 reviewer, admin만 할 수 있다. */
export function AssignmentCard({ report }: { report: Report }) {
  const { canReview, membership } = useSession();
  const client = useQueryClient();

  function applyUpdate(updated: Report) {
    client.setQueryData(reportKeys.report(report.id), updated);
    // 목록과 대시보드는 진행 단계, 담당자를 보여주므로 다시 받는다.
    void client.invalidateQueries({ queryKey: ["reports"] });
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
  const assignee = report.assignee;
  const help =
    report.progress === "triaged" || report.progress === "new"
      ? "재현 없이 ‘수정 중’으로 넘기면, 마감할 때 돌릴 테스트가 없어요."
      : closed
        ? "수정 확인을 통과해 마감된 신고예요."
        : "수정을 시작하면 ‘수정 중’으로 바꾸세요. 수정 확인을 통과하면 자동으로 마감돼요.";

  return (
    <Card title="담당과 상태">
      {assignee?.active && (
        <div className="flex items-center gap-2.5">
          <Avatar name={assignee.display_name ?? assignee.email ?? ""} size={32} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold">{assignee.display_name ?? assignee.email}</span>
            {assignee.display_name && assignee.email && (
              <span className="truncate text-xs text-muted">{assignee.email}</span>
            )}
          </div>
        </div>
      )}

      <Labeled label="담당자">
        {canReview ? (
          <AssigneeSelect
            // 신고 응답에 조직 id가 없어 현재 조직의 멤버를 쓴다(신고 목록도 현재 조직 기준).
            orgId={membership.org_id}
            assignee={assignee}
            disabled={assign.isPending}
            onChange={(userId) => assign.mutate(userId)}
          />
        ) : (
          <span className="text-[15px] font-medium">
            {!assignee ? "담당자 없음" : assignee.active ? (assignee.display_name ?? assignee.email) : "(나간 멤버)"}
          </span>
        )}
      </Labeled>

      <Labeled label="처리 상태">
        {canReview && !closed ? (
          <Select
            label="처리 상태"
            value={report.workflow_status}
            disabled={workflow.isPending}
            onChange={(event) => workflow.mutate(event.target.value)}
          >
            {SETTABLE_WORKFLOW_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labels.workflowStatus(status).label}
              </option>
            ))}
          </Select>
        ) : (
          <span className="text-[15px] font-medium">{labels.workflowStatus(report.workflow_status).label}</span>
        )}
      </Labeled>

      <p className="text-xs leading-[19px] text-muted">{help}</p>
      {workflow.error && <WorkflowError error={workflow.error} prefix="처리 상태를 바꾸지 못했어요." />}
      {assign.error && <WorkflowError error={assign.error} prefix="담당자를 바꾸지 못했어요." />}
    </Card>
  );
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

  if (members.isError) return <ErrorText error={members.error} prefix="멤버 목록을 불러오지 못했어요." />;

  const active = members.data?.filter((member) => member.is_active) ?? [];
  // 지금 담당자가 목록에 없으면(나간 멤버) 선택지로 남겨 현재 값을 보여준다.
  const missing = assignee && !active.some((member) => member.user_id === assignee.id);

  return (
    <Select
      label="담당자"
      value={assignee?.id ?? ""}
      disabled={disabled || members.isPending}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">{members.isPending ? "멤버를 불러오는 중…" : "담당자 없음"}</option>
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
    </Select>
  );
}
