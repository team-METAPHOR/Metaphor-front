"use client";

import { Card, formatClock } from "@/components/ui";
import type { Schemas } from "@/lib/api";
import { WRITE_ENVIRONMENTS, jobErrorReason, nextAction, requestBlocker, resourceType } from "@/lib/labels";
import { useHandoff } from "./queries";

type Attempt = Schemas["DiagnosisAttempt"];
type Fact = Schemas["ObservedFact"];
type NextAction = Schemas["NextAction"];
type Blocked = Schemas["BlockedRequest"];
type Write = Schemas["StateChangingRequest"];
type Approval = Schemas["StateChangeApproval"];

/** 다음 행동을 맡을 쪽. 모르는 값은 원문. */
const OWNERS: Record<string, string> = {
  reporter: "신고자",
  backend: "사이트 설정",
  developer: "개발자",
  operator: "운영자",
};

/** 계획 단계의 동작. 입력값은 서버가 내려주지 않는다. */
const STEP_ACTIONS: Record<string, string> = {
  navigate: "페이지 이동",
  click: "누르기",
  fill: "입력",
  select: "선택",
  press: "키 누르기",
  hover: "올려 두기",
  wait: "기다리기",
  check: "확인",
};

const LEVELS: Record<string, string> = { critical: "매우 높음", high: "높음", medium: "중간", low: "낮음" };
const LEVEL_CLASS: Record<string, string> = {
  critical: "text-danger",
  high: "text-danger",
  medium: "text-warning-ink",
  low: "text-subtle",
};

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1 rounded-md bg-chip px-2 py-1 text-[11px]">
      <span className="text-subtle">{label}</span>
      <span className={`font-semibold ${LEVEL_CLASS[value] ?? "text-label"}`}>{LEVELS[value] ?? value}</span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      {children}
    </section>
  );
}

function AttemptRow({ attempt }: { attempt: Attempt }) {
  const total = attempt.total_steps;
  // 멈춘 단계(0부터). 서버가 주지 않으면 끝낸 단계 다음으로 본다.
  const stopped = attempt.failed_step_index ?? (total != null && attempt.completed_steps < total ? attempt.completed_steps : null);
  const step = attempt.next_step;
  const blocker = attempt.blocker ? (jobErrorReason(attempt.blocker) ?? attempt.blocker) : null;

  return (
    <li className="flex flex-col gap-2.5 rounded-lg bg-surface-inset px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">
          시도 {attempt.attempt}
          {total != null &&
            (stopped != null ? ` · ${total}단계 중 ${stopped + 1}단계에서 멈춤` : ` · ${total}단계 모두 진행`)}
        </span>
        {attempt.elapsed_seconds != null && (
          <span className="text-xs text-muted tabular-nums">{formatClock(attempt.elapsed_seconds)}</span>
        )}
      </div>
      {total != null && total > 0 && (
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={`h-1 flex-1 rounded-full ${
                index < attempt.completed_steps ? "bg-primary" : index === stopped ? "bg-danger" : "bg-chip"
              }`}
            />
          ))}
        </div>
      )}
      {(step || blocker) && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {step && (
            <div className="flex min-w-0 gap-1.5">
              <dt className="text-muted">멈춘 단계</dt>
              <dd className="min-w-0 break-all text-label">
                {STEP_ACTIONS[step.action] ?? step.action} <code className="font-mono text-xs">{step.target}</code>
              </dd>
            </div>
          )}
          {blocker && (
            <div className="flex min-w-0 gap-1.5">
              <dt className="text-muted">막힌 이유</dt>
              <dd className="min-w-0 break-words text-label">{blocker}</dd>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}

/** 작은 회색 표시. 글자 그대로 보여 준다. */
function Tag({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded bg-chip px-1.5 py-0.5 font-sans text-[11px] font-medium text-label">{children}</span>;
}

function FactRow({ fact }: { fact: Fact }) {
  const failed = fact.status != null && fact.status >= 400;
  return (
    <li className="flex min-w-0 items-center gap-2.5 font-mono text-[13px]">
      {fact.method && <span className="shrink-0 text-xs font-semibold text-subtle">{fact.method}</span>}
      {/* 쿼리를 뺀 주소. 링크로 만들지 않는다. */}
      <span className="min-w-0 truncate text-body">{fact.url}</span>
      {fact.status != null && (
        <span className={`shrink-0 text-xs font-semibold ${failed && !fact.non_fatal ? "text-danger" : "text-warning-ink"}`}>
          {fact.status}
        </span>
      )}
      {fact.non_fatal && <Tag>기록만 함</Tag>}
    </li>
  );
}

/** 같은 요청은 한 줄로 묶고 어느 시도에서 나왔는지 붙인다. */
function blockedRows(attempts: Attempt[]): { request: Blocked; attempts: number[] }[] {
  const rows = new Map<string, { request: Blocked; attempts: number[] }>();
  for (const attempt of attempts) {
    for (const request of attempt.blocked_requests ?? []) {
      const key = [request.method, request.url, request.resource_type, request.blocker].join(" ");
      const row = rows.get(key) ?? { request, attempts: [] };
      if (!row.attempts.includes(attempt.attempt)) row.attempts.push(attempt.attempt);
      rows.set(key, row);
    }
  }
  return [...rows.values()];
}

function BlockedSection({ attempts }: { attempts: Attempt[] }) {
  const rows = blockedRows(attempts);
  if (rows.length === 0) return null;
  return (
    <Section title={`차단한 하위 리소스 ${rows.length}건`}>
      <p className="rounded-md bg-warning-soft px-2.5 py-[7px] text-xs leading-5 font-medium text-warning-ink">
        허용 범위 밖 SDK·외부 리소스를 차단한 채 관찰했어요. 결과는 그대로지만 실제 화면과 다를 수 있어요.
      </p>
      <ul className="flex flex-col gap-1.5 rounded-lg bg-surface-inset px-4 py-3">
        {rows.map(({ request, attempts: seen }, index) => (
          <li key={index} className="flex min-w-0 items-center gap-2.5 font-mono text-[13px]">
            {request.method && <span className="shrink-0 text-xs font-semibold text-subtle">{request.method}</span>}
            {/* 쿼리를 뺀 주소. 링크로 만들거나 불러오지 않는다. */}
            <span className="min-w-0 truncate text-body" title={request.url}>
              {request.url}
            </span>
            {request.resource_type && <Tag>{resourceType(request.resource_type)}</Tag>}
            {request.blocker && <Tag>{requestBlocker(request.blocker)}</Tag>}
            <span className="shrink-0 font-sans text-[11px] text-muted">시도 {seen.join("·")}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ApprovalSection({ approval }: { approval: Approval | null | undefined }) {
  return (
    <Section title="쓰기 승인">
      {approval ? (
        <div className="flex flex-col gap-1.5 rounded-lg bg-surface-inset px-4 py-3 text-[13px]">
          <p className="text-label">
            {WRITE_ENVIRONMENTS[approval.environment] ?? approval.environment} 환경 · 초기화{" "}
            <code className="font-mono text-xs">{approval.reset_adapter_id}</code>
          </p>
          <ul className="flex flex-col gap-1 font-mono">
            {approval.allowed_requests.map(([method, path], index) => (
              <li key={index} className="flex min-w-0 gap-2.5">
                <span className="shrink-0 text-xs font-semibold text-subtle">{method}</span>
                <span className="min-w-0 truncate text-body">{path}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] text-subtle">승인된 쓰기 없음. 읽기 전용으로 실행했어요.</p>
      )}
    </Section>
  );
}

function WriteRow({ request }: { request: Write }) {
  const sent = request.send_attempted === true ? "전송 시도" : request.send_attempted === false ? "보내지 않음" : null;
  return (
    <li className="flex min-w-0 items-center gap-2.5 font-mono text-[13px]">
      <span className="shrink-0 text-xs font-semibold text-subtle">{request.method}</span>
      <span className="min-w-0 truncate text-body">{request.path}</span>
      {sent && <Tag>{sent}</Tag>}
      {request.status != null && (
        <span className={`shrink-0 text-xs font-semibold ${request.status >= 400 ? "text-warning-ink" : "text-label"}`}>
          {request.status}
        </span>
      )}
      {request.blocker && <Tag>{requestBlocker(request.blocker)}</Tag>}
    </li>
  );
}

function WritesSection({ attempts }: { attempts: Attempt[] }) {
  const rows = attempts.filter((attempt) => (attempt.state_changing_requests ?? []).length > 0);
  if (rows.length === 0) return null;
  return (
    <Section title="상태 변경 요청">
      <ol className="flex flex-col gap-2">
        {rows.map((attempt) => (
          <li key={attempt.attempt} className="flex flex-col gap-1.5 rounded-lg bg-surface-inset px-4 py-3">
            <span className="text-xs font-medium text-muted">시도 {attempt.attempt}</span>
            <ul className="flex flex-col gap-1">
              {attempt.state_changing_requests.map((request, index) => (
                <WriteRow key={index} request={request} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">‘전송 시도’는 요청을 보냈다는 뜻이고, 서버에서 변경이 성공했다는 뜻은 아니에요.</p>
    </Section>
  );
}

function NextActionRow({ action }: { action: NextAction }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-px shrink-0 rounded bg-chip px-1.5 py-0.5 text-[11px] font-medium text-label">
        {OWNERS[action.owner] ?? action.owner}
      </span>
      {/* 아는 코드는 화면 문장, 모르면 엔진이 쓴 문장을 글자 그대로 보여 준다. */}
      <span className="min-w-0 text-[13px] leading-5 break-words text-body">{nextAction(action)}</span>
    </li>
  );
}

/**
 * 실행 진단: 어디서 멈췄는지, 차단한 리소스·쓰기 승인·상태 변경 요청, 실제로 본 요청, 다음에 할 일.
 * 진단은 신고의 가장 최근 실행 것이라 jobId와 다르면 그리지 않는다(지난 실행의 목록을 섞지 않는다).
 * reproduced면 멈춘 지점은 시도 결과 카드가 보여 주므로 빼고, 실행 조건에 알릴 것이 있을 때만 그린다.
 */
export function DiagnosisCard({ reportId, jobId, reproduced = false }: { reportId: string; jobId: string; reproduced?: boolean }) {
  const handoff = useHandoff(reportId);
  const data = handoff.data;
  const diagnosis = data?.diagnosis;
  if (!data || !diagnosis || data.job_id !== jobId) return null;

  const { attempts, observed_facts: facts, next_actions: actions } = diagnosis;
  const approval = diagnosis.state_changes;
  const summary = diagnosis.summary ?? diagnosis.interpretation;
  const blocked = attempts.some((attempt) => (attempt.blocked_requests ?? []).length > 0);
  const writes = attempts.some((attempt) => (attempt.state_changing_requests ?? []).length > 0);
  const noted = blocked || writes || approval != null || facts.length > 0 || actions.length > 0;
  if (reproduced ? !noted : !summary && attempts.length === 0 && !noted) return null;
  const levels = (data.severity || data.confidence) && (
    <div className="flex shrink-0 gap-1.5">
      {data.severity && <Chip label="심각도" value={data.severity} />}
      {data.confidence && <Chip label="확신도" value={data.confidence} />}
    </div>
  );

  return (
    <Card title="실행 진단" description={summary} aside={levels}>
      {!reproduced && attempts.length > 0 && (
        <Section title="멈춘 지점">
          <ol className="flex flex-col gap-2">
            {attempts.map((attempt) => (
              <AttemptRow key={attempt.attempt} attempt={attempt} />
            ))}
          </ol>
        </Section>
      )}
      <BlockedSection attempts={attempts} />
      {(approval || writes) && <ApprovalSection approval={approval} />}
      <WritesSection attempts={attempts} />
      {facts.length > 0 && (
        <Section title="관찰한 사실">
          <ul className="flex flex-col gap-1.5 rounded-lg bg-surface-inset px-4 py-3">
            {facts.map((fact, index) => (
              <FactRow key={index} fact={fact} />
            ))}
          </ul>
        </Section>
      )}
      {actions.length > 0 && (
        <Section title="다음에 할 일">
          <ul className="flex flex-col gap-2">
            {actions.map((action, index) => (
              <NextActionRow key={`${action.code}-${index}`} action={action} />
            ))}
          </ul>
        </Section>
      )}
      <p className="text-xs text-muted">
        {levels ? "심각도·확신도는 AI 추정이에요. " : ""}
        {reproduced ? "차단·요청 기록과 관찰한 사실" : "멈춘 지점과 관찰한 사실"}은 실제 실행 기록이에요.
        {facts.some((fact) => fact.non_fatal) && " ‘기록만 함’은 엔진이 기록하고 실행을 이어 간 응답으로, 이것만으로 실패나 버그를 뜻하지 않아요."}
      </p>
    </Card>
  );
}
