import { type Report, startOfWeek } from "../reports/all-reports";

/** 확인할 제보 카드 순서. 카드를 누르면 같은 상태로 거른 제보 목록으로 간다. */
export const STATUS_CARDS = [
  { progress: "reproduced", label: "재현 완료" },
  { progress: "reproducing", label: "재현 중" },
  { progress: "triaged", label: "재현 안 됨" },
  { progress: "new", label: "신규 제보" },
  { progress: "fixing", label: "버그 수정 중" },
] as const;

const ATTENTION_LIMIT = 5;

export function computeStats(reports: Report[], now = new Date()) {
  const byProgress = new Map<string, number>();
  for (const report of reports) byProgress.set(report.progress, (byProgress.get(report.progress) ?? 0) + 1);

  // 사람이 지금 봐야 하는 신고: 재현됐거나, 재현되지 않아 정보가 필요한 신고
  const attention = reports
    .filter((report) => report.progress === "reproduced" || report.progress === "triaged")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, ATTENTION_LIMIT);

  const weekStart = startOfWeek(now).getTime();
  const inWeek = (value: string | null) => value != null && Date.parse(value) >= weekStart;

  // 이번 주 접수 중 판정이 난 신고의 재현 비율
  const judged = reports.filter((report) => inWeek(report.created_at) && report.latest_job?.verdict != null);
  const reproduced = judged.filter((report) => report.latest_job?.verdict === "reproduced").length;

  return {
    count: (progress: string) => byProgress.get(progress) ?? 0,
    attention,
    /** 판정된 신고가 없으면 null */
    autoReproductionRate: judged.length > 0 ? reproduced / judged.length : null,
    judgedCount: judged.length,
    /** 이번 주 수정 확인(재시험)을 통과해 마감된 신고 */
    fixVerified: reports.filter((report) => inWeek(report.closed_at)).length,
  };
}
