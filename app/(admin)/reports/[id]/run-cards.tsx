"use client";

import { useState } from "react";
import { Card, Icon, button } from "@/components/ui";
import type { Schemas } from "@/lib/api";
import * as labels from "@/lib/labels";
import type { EngineResult } from "@/types/report";
import { evidenceUrl, isActiveJob, useArtifacts, useHandoff, useJobEvents } from "./queries";
import { ErrorText, Inset, Labeled, Muted, formatDateTime, formatTime, formatTimeRange } from "./ui";

type Job = Schemas["JobOut"];
type Report = Schemas["ReportDetail"];
type Step = NonNullable<NonNullable<EngineResult["report"]>["scenario"]>["steps"][number];
type Attempt = NonNullable<NonNullable<EngineResult["report"]>["run"]>["evidence"][number];

// ---------------------------------------------------------------- 실행 타임라인

type Phase = { title: string; kinds: string[] };

// 엔진 이벤트 kind를 화면의 4단계로 묶는다. 첫 단계(신고 수집)는 신고 접수 시각을 쓴다.
const PHASES: Phase[] = [
  { title: "계획 세우기", kinds: ["received", "interpreting", "discovering", "planning", "plan_rejected", "replanning"] },
  { title: "브라우저 실행", kinds: ["running", "retesting"] },
  { title: "현상 비교", kinds: ["reporting"] },
];

type StepState = "done" | "current" | "todo";

export function TimelineCard({ report, job, attempts }: { report: Report; job: Job; attempts: number }) {
  const active = isActiveJob(job.status);
  const events = useJobEvents(job.id, active);
  const items = events.data?.items ?? [];

  const ranges = PHASES.map((phase) => {
    const hits = items.filter((event) => phase.kinds.includes(event.kind));
    return hits.length ? { start: hits[0].created_at, end: hits.at(-1)!.created_at } : null;
  });
  // 가장 늦게 시작한 단계가 지금 단계다.
  const reached = ranges.reduce((last, range, index) => (range ? index : last), -1);

  const state = (index: number): StepState => {
    if (!active) return job.finished_at || index <= reached ? "done" : "todo";
    if (index < reached) return "done";
    return index === reached ? "current" : "todo";
  };

  const verdictText: Record<string, string> = {
    reproduced: "신고와 같은 현상이 나왔어요",
    not_reproduced: "같은 현상이 나오지 않았어요",
    inconclusive: "같은 현상인지 판단하지 못했어요",
  };
  const finalText =
    job.status === "needs_info"
      ? "재현에 필요한 정보가 더 있어요"
      : job.verdict
        ? verdictText[job.verdict] ?? labels.verdict(job.verdict).label
        : job.status === "failed"
          ? "실행이 실패했어요"
          : "판정을 기다리는 중이에요";

  const steps = [
    { title: "신고 수집", time: formatTime(report.created_at), text: "신고 내용과 환경 정보를 모았어요", state: "done" as StepState },
    {
      title: PHASES[0].title,
      time: formatTimeRange(ranges[0]?.start, ranges[0]?.end),
      text: "신고를 해석하고 재현 절차를 만들었어요",
      state: state(0),
    },
    {
      title: PHASES[1].title,
      time: formatTimeRange(ranges[1]?.start, ranges[1]?.end),
      text: attempts > 0 ? `실제 브라우저에서 ${attempts}번 실행했어요` : "실제 브라우저에서 절차를 실행해요",
      state: state(1),
    },
    {
      title: PHASES[2].title,
      time: formatTimeRange(ranges[2]?.start, job.finished_at ?? ranges[2]?.end),
      text: finalText,
      state: job.finished_at ? ("done" as StepState) : state(2),
    },
  ];

  return (
    <Card title="실행 타임라인" aside={active && <span className="text-[13px] text-subtle">3초마다 갱신 중</span>}>
      {events.isError && <ErrorText error={events.error} prefix="진행 기록을 불러오지 못했어요." />}
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
        {steps.map((step, index) => (
          <li key={step.title} className="flex min-w-0 flex-col gap-2 lg:pr-4">
            <div className="flex items-center gap-2">
              <StepIcon state={step.state} size={22} />
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={`hidden h-0.5 flex-1 lg:block ${step.state === "done" ? "bg-primary/35" : "bg-chip"}`}
                />
              )}
            </div>
            <span className={`text-[15px] font-semibold ${step.state === "todo" ? "text-muted" : ""}`}>{step.title}</span>
            {step.time && <span className="text-xs text-subtle tabular-nums">{step.time}</span>}
            <span className="text-[13px] leading-5 text-subtle">{step.state === "todo" ? "대기 중" : step.text}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function StepIcon({ state, size }: { state: StepState; size: number }) {
  const name = state === "done" ? "step-done" : state === "current" ? "step-current" : "step-todo";
  return <Icon name={name} size={size} className={state === "current" ? "animate-pulse" : undefined} />;
}

// ---------------------------------------------------------------- 시도 결과

const ROWS_FOLDED = 4;

/**
 * 시도별 결과. 서버는 같은 절차를 2번 실행한 기록만 준다.
 * 조건을 바꿔 여러 번 실행한 결과(환경 차이 역추적)는 서버 지원이 필요하다(Metaphor-back#60).
 */
export function AttemptsCard({
  attempts,
  stepCount,
  reproduced,
}: {
  attempts: Attempt[];
  stepCount: number;
  reproduced: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (attempts.length === 0) return null;
  const observed = attempts.filter((attempt) => attempt.symptom_observed === true).length;
  const rows = expanded ? attempts : attempts.slice(0, ROWS_FOLDED);

  return (
    <Card
      title={reproduced ? "재현 시도 결과" : `시도한 결과 ${attempts.length}건`}
      description={`같은 절차를 Chrome에서 ${attempts.length}번 실행했어요. ${attempts.length}번 중 ${observed}번 같은 현상`}
    >
      <div role="table" className="flex flex-col">
        <div role="row" className="grid grid-cols-[28px_minmax(0,1fr)_120px_minmax(0,1.4fr)] gap-3 rounded-lg bg-surface-inset p-3 text-xs text-muted">
          <span role="columnheader">#</span>
          <span role="columnheader">실행 결과</span>
          <span role="columnheader">진행</span>
          <span role="columnheader">멈춘 지점</span>
        </div>
        {rows.map((attempt) => {
          const tone =
            attempt.symptom_observed === true ? "success" : attempt.blocker ? "warning" : ("plain" as const);
          return (
            <div
              key={attempt.id ?? attempt.attempt}
              role="row"
              className={`grid grid-cols-[28px_minmax(0,1fr)_120px_minmax(0,1.4fr)] items-center gap-3 rounded-lg p-3 text-sm ${
                tone === "success" ? "bg-primary-soft" : tone === "warning" ? "bg-warning/8" : ""
              }`}
            >
              <span role="cell" className={`font-mono text-[13px] ${tone === "warning" ? "text-warning-ink" : "text-muted"}`}>
                {attempt.attempt}
              </span>
              <span
                role="cell"
                className={`font-semibold ${
                  tone === "success" ? "text-primary-ink" : tone === "warning" ? "text-warning-ink" : "font-medium text-muted"
                }`}
              >
                {attempt.symptom_observed === true
                  ? "같은 현상"
                  : attempt.blocker
                    ? "진행이 막힘"
                    : attempt.symptom_observed === false
                      ? "정상 동작"
                      : "확인 불가"}
              </span>
              <span role="cell" className="font-mono text-[13px] text-subtle">
                {stepCount > 0 ? `${attempt.completed_steps ?? 0} / ${stepCount}단계` : `${attempt.completed_steps ?? 0}단계`}
              </span>
              <span role="cell" className="min-w-0 break-words text-label">
                {attempt.blocker ?? (attempt.expected_observed ? "기대한 결과 확인" : "-")}
              </span>
            </div>
          );
        })}
      </div>
      {attempts.length > ROWS_FOLDED && (
        <button type="button" className={`${button.ghost} self-start`} onClick={() => setExpanded((value) => !value)}>
          {expanded ? "접기" : `나머지 ${attempts.length - ROWS_FOLDED}건 펼치기`}
        </button>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- 재현 절차

const actionLabel: Record<string, string> = {
  navigate: "이동",
  click: "클릭",
  fill: "입력",
  assert_text: "확인",
};

/** 복사할 때 쓰는 사람이 읽는 절차 */
export function stepsText(number: number, steps: Step[]): string {
  const lines = steps.map((step, index) => {
    const value = step.value ? ` "${step.value}"` : "";
    return `${index + 1}. ${actionLabel[step.action] ?? step.action} ${step.target}${value}`;
  });
  return [`BUG-${number} 재현 절차`, ...lines].join("\n");
}

export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`${button.ghost} ${className ?? ""}`}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      <span aria-live="polite">{copied ? "복사했어요" : label}</span>
    </button>
  );
}

/**
 * AI가 만든 재현 절차. Playwright 테스트 파일은 서버가 아직 저장하지 않는다(Metaphor-back#62).
 * 대신 엔진 보고서·결과 파일을 내려받을 수 있게 한다.
 */
export function StepsCard({ report, jobId, steps }: { report: Report; jobId: string; steps: Step[] }) {
  const artifacts = useArtifacts(jobId);
  const files = (artifacts.data?.items ?? []).filter((item) => item.kind === "report_md" || item.kind === "json");
  if (steps.length === 0) return null;

  return (
    <Card
      title="재현 절차"
      description="AI가 만들어 실제 브라우저에서 실행한 절차예요. 같은 순서로 따라 하면 재현돼요."
      aside={
        <div className="flex shrink-0 gap-2">
          <CopyButton text={stepsText(report.number, steps)} label="복사" />
          {files.map((file) => (
            <a key={file.id} href={evidenceUrl(file.id)} download className={button.ghost}>
              {file.kind === "report_md" ? "보고서" : "결과 JSON"} 내려받기
            </a>
          ))}
        </div>
      }
    >
      <div className="overflow-hidden rounded-lg bg-code">
        <div className="border-b border-line px-4 py-2.5 font-mono text-xs text-subtle">bug-{report.number}.steps</div>
        <ol className="flex flex-col gap-1 overflow-x-auto p-4 font-mono text-[13px] leading-[22px] text-label">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3 whitespace-pre">
              <span className="w-5 shrink-0 text-right text-faint">{index + 1}</span>
              <span className="min-w-14 shrink-0 text-subtle">{actionLabel[step.action] ?? step.action}</span>
              <span>
                {step.target}
                {step.value && <span className="text-primary-ink"> &apos;{step.value}&apos;</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- 재현 스크린샷

/** 재현 영상과 trace는 서버가 아직 저장하지 않아(Metaphor-back#62) 스크린샷을 보여준다. */
export function ScreenshotsCard({ jobId }: { jobId: string }) {
  const artifacts = useArtifacts(jobId);
  const shots = (artifacts.data?.items ?? []).filter((item) => item.kind === "screenshot");
  if (artifacts.isError) {
    return (
      <Card title="재현 스크린샷">
        <ErrorText error={artifacts.error} prefix="스크린샷을 불러오지 못했어요." />
      </Card>
    );
  }
  if (shots.length === 0) return null;

  return (
    <Card title="재현 스크린샷" aside={<span className="text-[13px] text-subtle">{shots.length}장</span>}>
      <ul id="screenshots" className="grid gap-3 rounded-lg bg-code p-4 sm:grid-cols-2">
        {shots.map((item) => (
          <li key={item.id} className="flex flex-col gap-2">
            <a href={evidenceUrl(item.id)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element -- 세션 쿠키가 필요한 같은 출처 이미지라 최적화 프록시를 거치지 않는다. */}
              <img
                src={evidenceUrl(item.id)}
                alt={`재현 스크린샷 (${formatDateTime(item.created_at)})`}
                loading="lazy"
                className="aspect-video w-full object-cover object-top transition hover:opacity-90"
              />
            </a>
            <span className="text-xs text-label tabular-nums">{formatTime(item.created_at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------- AI 분석

const handoffState: Record<string, string> = {
  pending: "AI가 분석하는 중이에요.",
  unavailable: "분석 결과가 없어요.",
  expired: "보관 기간이 지나 분석이 만료됐어요.",
};

/** 재현됨: 유력한 재현 조건(옆 칸). 원인은 확정이 아니라는 점을 늘 밝힌다. */
export function LikelyConditionCard({ reportNumber, job, steps }: { reportNumber: number; job: Job; steps: Step[] }) {
  const handoff = useHandoff(job.report_id);
  const ready = handoff.data?.state === "ready" ? handoff.data : null;
  const headline = ready?.hypotheses[0]?.description ?? ready?.summary ?? null;

  return (
    <Card title="유력한 재현 조건">
      {handoff.isError ? (
        <ErrorText error={handoff.error} prefix="분석을 불러오지 못했어요." />
      ) : (
        <Inset className="flex flex-col gap-1.5">
          <p className="text-[15px] font-semibold break-words">
            {headline ?? handoffState[handoff.data?.state ?? "pending"] ?? "분석을 불러오는 중…"}
          </p>
          {job.reason_code && <p className="text-[13px] text-subtle">{labels.reasonCode(job.reason_code).label}</p>}
        </Inset>
      )}
      <p className="self-start rounded-md bg-warning-soft px-2.5 py-[7px] text-xs font-medium text-warning-ink">
        원인은 아직 확정되지 않았어요. 개발자 확인이 필요해요.
      </p>
      <a href="#screenshots" className={`${button.secondary} w-full`}>
        재현 스크린샷 보기
      </a>
      {steps.length > 0 && <CopyButton text={stepsText(reportNumber, steps)} label="재현 절차 복사" className="w-full" />}
    </Card>
  );
}

/** 재현 안 됨: 가장 근접했던 계획. */
export function ClosestPlanCard({ reportId, attempts }: { reportId: string; attempts: Attempt[] }) {
  const handoff = useHandoff(reportId);
  const ready = handoff.data?.state === "ready" ? handoff.data : null;
  // 가장 많이 진행한 시도를 근접한 시도로 본다.
  const closest = [...attempts].sort((a, b) => (b.completed_steps ?? 0) - (a.completed_steps ?? 0))[0];

  return (
    <Card
      title="가장 근접했던 계획"
      description={closest ? `${closest.attempt}번째 시도, ${closest.completed_steps ?? 0}단계까지 진행${closest.blocker ? ` 후 멈춤: ${closest.blocker}` : ""}` : undefined}
    >
      {handoff.isPending ? (
        <Muted>분석을 불러오는 중…</Muted>
      ) : handoff.isError ? (
        <ErrorText error={handoff.error} prefix="분석을 불러오지 못했어요." />
      ) : !ready ? (
        <Muted>{handoffState[handoff.data.state] ?? handoff.data.state}</Muted>
      ) : (
        <div className="flex flex-col gap-4">
          <Labeled label="가설">
            <p className="text-[15px] leading-6 font-medium break-words">
              {ready.hypotheses[0]?.description ?? "세운 가설이 없어요."}
            </p>
          </Labeled>
          <Labeled label="판정">
            <p className="text-[15px] leading-6 font-medium whitespace-pre-wrap break-words">{ready.summary ?? "-"}</p>
          </Labeled>
        </div>
      )}
    </Card>
  );
}

/** AI가 제안한 해결 방안. 있을 때만 보인다. */
export function SolutionsCard({ reportId }: { reportId: string }) {
  const handoff = useHandoff(reportId);
  const solutions = handoff.data?.state === "ready" ? handoff.data.solutions : [];
  if (solutions.length === 0) return null;

  return (
    <Card title="해결 방안" description="AI가 제안한 방법이에요. 적용 전에 개발자가 확인하세요.">
      <div className="flex flex-col gap-3">
        {solutions.map((solution, index) => (
          <Inset key={index} className="flex flex-col gap-2 text-sm">
            <p className="text-[15px] font-semibold break-words">{solution.title}</p>
            <p className="leading-6 whitespace-pre-wrap break-words text-label">{solution.description}</p>
            {solution.verification_steps.length > 0 && (
              <Labeled label="확인 방법">
                <ol className="list-decimal space-y-1 pl-5 text-label">
                  {solution.verification_steps.map((item, i) => (
                    <li key={i} className="break-words">
                      {item}
                    </li>
                  ))}
                </ol>
              </Labeled>
            )}
          </Inset>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- 진행 상태

const STAGES = [
  { key: "new", label: "신규 신고" },
  { key: "reproducing", label: "재현 중" },
  { key: "reproduced", label: "재현 완료" },
  { key: "fixing", label: "버그 수정 중" },
  { key: "closed", label: "마감" },
] as const;

/** 대시보드 5단계 중 몇 번째인지(0부터). triaged(재현 안 됨)도 "재현 완료" 단계. 단계 밖이면 -1 */
export function stageIndex(progress: string): number {
  const key = progress === "triaged" ? "reproduced" : progress;
  return STAGES.findIndex((stage) => stage.key === key);
}

export function ProgressCard({ report, job }: { report: Report; job: Job | undefined }) {
  const current = stageIndex(report.progress);
  const notes: Record<string, string> = {
    new: formatDateTime(report.created_at),
    reproducing: job?.started_at ? formatTimeRange(job.started_at, job.finished_at) : "자동 재현을 기다리는 중",
    reproduced:
      report.progress === "triaged"
        ? "재현되지 않았어요"
        : job?.reason_code
          ? labels.reasonCode(job.reason_code).label
          : "재현에 성공하면",
    fixing: "담당자가 수정을 시작하면",
    closed: report.closed_at ? formatDateTime(report.closed_at) : "수정 확인을 통과하면 마감",
  };

  return (
    <Card title="진행 상태">
      {current < 0 ? (
        <Muted>
          {report.progress === "dismissed" ? "버그 아님·중복으로 종료된 신고예요." : labels.progress(report.progress).label}
        </Muted>
      ) : (
        <ol className="flex flex-col gap-4">
          {STAGES.map((stage, index) => {
            const state: StepState = index < current || report.progress === "closed" ? "done" : index === current ? "current" : "todo";
            return (
              <li key={stage.key} className="flex items-start gap-3">
                <StepIcon state={state} size={20} />
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <span
                    className={`text-[15px] ${
                      state === "current" ? "font-semibold text-primary-ink" : state === "todo" ? "font-medium text-muted" : "font-medium"
                    }`}
                  >
                    {index === current && report.progress === "triaged" ? "재현 완료 (재현 안 됨)" : stage.label}
                    {state === "current" && <span className="sr-only"> (현재 단계)</span>}
                  </span>
                  <span className={`text-xs ${state === "todo" ? "text-faint" : "text-subtle"}`}>{notes[stage.key]}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
