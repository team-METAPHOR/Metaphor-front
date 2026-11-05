"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type Schemas } from "@/lib/api";

/** 확인할 제보 카드 순서. 카드를 누르면 같은 상태로 거른 제보 목록으로 간다. */
export const STATUS_CARDS = [
  { progress: "new", label: "신규 제보" },
  { progress: "reproducing", label: "재현 중" },
  { progress: "triaged", label: "재현 안 됨" },
  { progress: "reproduced", label: "재현 완료" },
  { progress: "fixing", label: "버그 수정 중" },
] as const;

/** 이번 주 월요일 00:00(브라우저 시간대). */
export function startOfWeek(now = new Date()): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (start.getDay() + 6) % 7; // 월요일 0
  start.setDate(start.getDate() - offset);
  return start;
}

/** 진행 단계별 개수(마감 포함)와 지금 사람이 봐야 하는 최근 제보 5건. 서버가 센다. */
export function useReportSummary(orgId: string) {
  return useQuery({
    queryKey: ["reports", "summary", orgId],
    queryFn: ({ signal }) =>
      api<Schemas["ReportSummary"]>(`/orgs/${encodeURIComponent(orgId)}/report-summary`, { signal }),
  });
}

/** 이번 주(월요일 0시부터 지금까지) 재현 지표. 서버가 집계한다. */
export function useWeeklyStats(orgId: string) {
  const from = startOfWeek().toISOString();
  return useQuery({
    queryKey: ["reports", "stats", orgId, from],
    queryFn: ({ signal }) =>
      api<Schemas["ReportStats"]>(
        `/orgs/${encodeURIComponent(orgId)}/report-stats?${new URLSearchParams({ from })}`,
        { signal },
      ),
  });
}
