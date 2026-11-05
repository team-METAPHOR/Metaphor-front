import type { Schemas } from "@/lib/api";
import * as labels from "@/lib/labels";
import type { Tone } from "@/lib/labels";

type Report = Schemas["ReportItem"];
type Program = Schemas["ProgramSummary"];

export type Bar = { key: string; label: string; count: number; tone: Tone };

// 대시보드 5단계 + 단계 밖(버그 아님·중복). reproduced와 triaged는 둘 다 "재현 완료" 단계다.
const STAGE_ORDER = ["new", "reproducing", "reproduced", "fixing", "closed", "dismissed"];
const stageOf = (report: Report) => (report.progress === "triaged" ? "reproduced" : report.progress);
const VERDICT_ORDER = ["reproduced", "not_reproduced", "inconclusive", ""];

function countBy(reports: Report[], keyOf: (report: Report) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const report of reports) {
    const key = keyOf(report);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** 알려진 값은 정해진 순서로 0건이어도 보여주고, 모르는 값은 뒤에 붙인다. */
function toBars(counts: Map<string, number>, order: string[], lookup: labels.Lookup): Bar[] {
  const keys = [...order, ...[...counts.keys()].filter((key) => !order.includes(key))];
  return keys.map((key) => ({ key, count: counts.get(key) ?? 0, ...lookup(key) }));
}

export function computeStats(reports: Report[], programs: Program[]) {
  const judged = reports.filter((report) => report.latest_job?.verdict != null);
  const reproduced = judged.filter((report) => report.latest_job?.verdict === "reproduced").length;
  // 사람이 아직 처리 방향(수정/버그 아님)을 정하지 않은 신고
  const pending = reports.filter((report) => report.workflow_status === "received").length;

  // 마감된 신고의 접수→마감 평균 시간(ms). 마감은 재시험 통과 때만 생긴다.
  const closedDurations = reports
    .filter((report) => report.closed_at != null)
    .map((report) => Date.parse(report.closed_at!) - Date.parse(report.created_at))
    .filter((ms) => Number.isFinite(ms) && ms >= 0);
  const avgCloseMs =
    closedDurations.length > 0 ? closedDurations.reduce((sum, ms) => sum + ms, 0) / closedDurations.length : null;

  const programNames = new Map(programs.map((program) => [program.id, program.name]));
  const byProgram = [...countBy(reports, (report) => report.program_id)]
    .map(([id, count]) => ({ key: id, label: programNames.get(id) ?? id, count, tone: "info" as Tone }))
    .sort((a, b) => b.count - a.count);

  const recent = [...reports].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return {
    total: reports.length,
    judgedCount: judged.length,
    /** 판정된 신고가 없으면 null */
    reproducedRate: judged.length > 0 ? reproduced / judged.length : null,
    reproduced,
    pending,
    closedCount: closedDurations.length,
    /** 마감된 신고가 없으면 null */
    avgCloseMs,
    stages: toBars(countBy(reports, stageOf), STAGE_ORDER, labels.progress),
    // null(판정 전)은 빈 문자열 키로 모은다. lookup이 "판정 전"으로 표시한다.
    verdict: toBars(countBy(reports, (r) => r.latest_job?.verdict ?? ""), VERDICT_ORDER, labels.verdict),
    byProgram,
    recent,
    programNames,
  };
}
