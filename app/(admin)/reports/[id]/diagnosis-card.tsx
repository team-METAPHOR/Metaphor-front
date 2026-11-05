"use client";

import { Card, formatClock } from "@/components/ui";
import type { Schemas } from "@/lib/api";
import { jobErrorReason } from "@/lib/labels";
import { useHandoff } from "./queries";

type Attempt = Schemas["DiagnosisAttempt"];
type Fact = Schemas["ObservedFact"];
type NextAction = Schemas["NextAction"];

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

function FactRow({ fact }: { fact: Fact }) {
  const failed = fact.status != null && fact.status >= 400;
  return (
    <li className="flex min-w-0 items-center gap-2.5 font-mono text-[13px]">
      {fact.method && <span className="shrink-0 text-xs font-semibold text-subtle">{fact.method}</span>}
      <span className="min-w-0 truncate text-body">{fact.url}</span>
      {fact.status != null && (
        <span className={`shrink-0 text-xs font-semibold ${failed ? "text-danger" : "text-warning-ink"}`}>{fact.status}</span>
      )}
    </li>
  );
}

function NextActionRow({ action }: { action: NextAction }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-px shrink-0 rounded bg-chip px-1.5 py-0.5 text-[11px] font-medium text-label">
        {OWNERS[action.owner] ?? action.owner}
      </span>
      {/* 엔진이 쓴 문장. 글자 그대로 보여 준다. */}
      <span className="min-w-0 text-[13px] leading-5 break-words text-body">{action.message}</span>
    </li>
  );
}

/**
 * 재현되지 않았거나 멈춘 실행의 진단: 어디서 멈췄는지, 실제로 본 요청, 다음에 할 일.
 * 진단은 신고의 가장 최근 실행 것이라 jobId와 다르면 그리지 않는다.
 */
export function DiagnosisCard({ reportId, jobId }: { reportId: string; jobId: string }) {
  const handoff = useHandoff(reportId);
  const data = handoff.data;
  const diagnosis = data?.diagnosis;
  if (!data || !diagnosis || data.job_id !== jobId) return null;

  const { attempts, observed_facts: facts, next_actions: actions } = diagnosis;
  const summary = diagnosis.summary ?? diagnosis.interpretation;
  if (!summary && attempts.length === 0 && facts.length === 0 && actions.length === 0) return null;
  const levels = (data.severity || data.confidence) && (
    <div className="flex shrink-0 gap-1.5">
      {data.severity && <Chip label="심각도" value={data.severity} />}
      {data.confidence && <Chip label="확신도" value={data.confidence} />}
    </div>
  );

  return (
    <Card title="실행 진단" description={summary} aside={levels}>
      {attempts.length > 0 && (
        <Section title="멈춘 지점">
          <ol className="flex flex-col gap-2">
            {attempts.map((attempt) => (
              <AttemptRow key={attempt.attempt} attempt={attempt} />
            ))}
          </ol>
        </Section>
      )}
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
        {levels ? "심각도·확신도는 AI 추정이에요. " : ""}멈춘 지점과 관찰한 사실은 실제 실행 기록이에요.
      </p>
    </Card>
  );
}
