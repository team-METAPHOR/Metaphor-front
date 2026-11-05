"use client";

import { Card, formatClock } from "@/components/ui";
import type { Schemas } from "@/lib/api";
import { conditionSummary, useTestConditions } from "@/lib/test-conditions";
import { isActiveJob, useJobConditions } from "./queries";
import { ErrorText } from "./ui";

type Job = Schemas["JobOut"];
type Item = Schemas["ConditionResultItem"];
type Outcome = Item["outcome"];

const OUTCOMES: Record<Outcome, { label: string; className: string }> = {
  reproduced: { label: "재현됨", className: "font-semibold text-primary-ink" },
  not_reproduced: { label: "재현 안 됨", className: "font-medium text-subtle" },
  blocked: { label: "막힘", className: "font-medium text-danger" },
  inconclusive: { label: "판단 불가", className: "font-medium text-warning-ink" },
  not_run: { label: "실행 못 함", className: "font-medium text-muted" },
  running: { label: "실행 중", className: "font-medium text-info" },
};

const COLUMNS = "grid grid-cols-[24px_minmax(0,1fr)_84px_minmax(0,200px)_44px] items-center gap-3 px-4";

function nameOf(item: Item): string {
  return item.condition?.label ?? item.condition_id;
}

/** 한 문장 요약. 재현된 조건 이름을 앞세운다. */
function summaryOf(items: Item[], attempted: number, reproduced: number, running: boolean): string {
  if (running) return `${items.length}개 조건을 차례로 실행하고 있어요. 끝난 조건부터 결과가 보여요.`;
  if (attempted === 0) return "실행한 조건이 없어요.";
  const ran = attempted < items.length ? `${items.length}개 조건 중 ${attempted}개를 실행해 ` : `${attempted}개 조건을 실행해 `;
  if (reproduced === 0) return `실행한 ${attempted}개 조건 모두에서 재현되지 않았어요.`;
  if (reproduced === attempted) return `${ran}모든 조건에서 재현됐어요.`;
  const names = items.filter((item) => item.outcome === "reproduced").map(nameOf).join(", ");
  return `${ran}${reproduced}개에서 재현됐어요. ${names} 조건에서만 같은 현상이 나왔어요.`;
}

/**
 * 조건 비교 실행(has_conditions)의 조건별 결과.
 * 재현된 조건이 없을 때만 "가장 멀리 진행"을 붙인다. 완료한 단계 수 기준이지 증상 유사도가 아니다.
 */
export function ConditionResultsCard({ job, programId }: { job: Job; programId: string }) {
  const active = isActiveJob(job.status);
  const results = useJobConditions(job.id, job.has_conditions, active);
  // AI가 고르지 않은 조건은 ID만 오므로 등록 목록에서 이름을 찾는다.
  const registered = useTestConditions(results.data?.not_selected_condition_ids.length ? programId : undefined);
  if (!job.has_conditions) return null;

  if (results.isError) {
    return (
      <Card title="조건별 결과">
        <ErrorText error={results.error} prefix="조건별 결과를 불러오지 못했어요." />
      </Card>
    );
  }
  if (!results.data) {
    return (
      <Card title="조건별 결과">
        <div className="h-32 animate-pulse rounded-lg bg-surface-inset" aria-busy="true" />
      </Card>
    );
  }

  const { items, attempted, reproduced, most_progressed_condition_ids: furthest } = results.data;
  const running = items.some((item) => item.outcome === "running");
  const showFurthest = !running && reproduced === 0 && attempted > 1;
  const skipped = results.data.not_selected_condition_ids.map(
    (id) => registered.data?.items.find((item) => item.condition_id === id)?.label ?? id,
  );

  return (
    <Card title="조건별 결과" description={summaryOf(items, attempted, reproduced, running)}>
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-[560px] flex-col gap-0.5" role="table" aria-label="조건별 결과">
          <div role="row" className={`${COLUMNS} rounded-lg bg-surface-inset py-2.5 text-xs text-muted`}>
            <span role="columnheader">#</span>
            <span role="columnheader">테스트 조건</span>
            <span role="columnheader">결과</span>
            <span role="columnheader">멈춘 지점</span>
            <span role="columnheader" className="text-right">
              소요
            </span>
          </div>
          {items.map((item) => {
            const outcome = OUTCOMES[item.outcome] ?? { label: item.outcome, className: "text-subtle" };
            const hit = item.outcome === "reproduced";
            return (
              <div
                key={item.condition_id}
                role="row"
                className={`${COLUMNS} rounded-lg py-3 ${hit ? "bg-primary-soft" : ""}`}
              >
                <span role="cell" className="text-[13px] text-muted tabular-nums">
                  {item.index}
                </span>
                <span role="cell" className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{nameOf(item)}</span>
                    {item.diagnosis?.next_actions.some((action) => action.code === "REVIEW_BLOCKED_SUBRESOURCES") && (
                      <span className="shrink-0 rounded bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning-ink">
                        리소스 차단
                      </span>
                    )}
                    {showFurthest && furthest.includes(item.condition_id) && (
                      <span className="shrink-0 rounded bg-chip px-1.5 py-0.5 text-[11px] font-medium text-label">
                        가장 멀리 진행
                      </span>
                    )}
                  </span>
                  {item.condition && <span className="truncate text-xs text-muted">{conditionSummary(item.condition)}</span>}
                </span>
                <span role="cell" className={`text-sm ${outcome.className}`}>
                  {outcome.label}
                </span>
                <span role="cell" className="text-xs leading-[18px] break-words text-subtle">
                  {item.stop_point ?? "-"}
                </span>
                <span role="cell" className="text-right text-[13px] text-subtle tabular-nums">
                  {item.duration_ms != null ? formatClock(item.duration_ms / 1000) : "-"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {showFurthest && furthest.length > 0 && (
        <p className="text-xs text-muted">‘가장 멀리 진행’은 완료한 단계 수 기준이에요. 신고 증상과 얼마나 비슷한지는 뜻하지 않아요.</p>
      )}
      {items.some((item) => item.diagnosis?.next_actions.some((action) => action.code === "REVIEW_BLOCKED_SUBRESOURCES")) && (
        <p className="text-xs text-muted">‘리소스 차단’은 허용 범위 밖 SDK·외부 리소스를 차단한 채 관찰한 조건이에요. 실제 화면과 다를 수 있어요.</p>
      )}
      {skipped.length > 0 && <p className="text-xs text-muted">AI가 고르지 않아 실행하지 않은 조건: {skipped.join(", ")}</p>}
    </Card>
  );
}
