import type { Schemas } from "@/lib/api";
import * as labels from "@/lib/labels";
import type { Tone } from "@/lib/labels";

type Report = Schemas["ReportItem"];
type Program = Schemas["ProgramSummary"];

export type Bar = { key: string; label: string; count: number; tone: Tone };

const WORKFLOW_ORDER = ["received", "in_review", "accepted", "closed"];
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
  const pending = reports.filter(
    (report) => report.workflow_status === "received" || report.workflow_status === "in_review",
  ).length;

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
    workflow: toBars(countBy(reports, (r) => r.workflow_status), WORKFLOW_ORDER, labels.workflowStatus),
    // null(판정 전)은 빈 문자열 키로 모은다. lookup이 "판정 전"으로 표시한다.
    verdict: toBars(countBy(reports, (r) => r.latest_job?.verdict ?? ""), VERDICT_ORDER, labels.verdict),
    byProgram,
    recent,
    programNames,
  };
}
