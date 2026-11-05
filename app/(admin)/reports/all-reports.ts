"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type Schemas } from "@/lib/api";

export type Report = Schemas["ReportItem"];
type ReportList = Schemas["ReportList"];

// 서버 목록 API에 진행 단계·기간 필터, 정렬, 총 개수, 통계가 없다(Metaphor-back#58, #59).
// 그래서 목록을 모두 받아 브라우저에서 거르고 센다. 해커톤 규모 기준 상한.
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
export const MAX_REPORTS = PAGE_SIZE * MAX_PAGES;

async function fetchAllReports(signal: AbortSignal): Promise<{ items: Report[]; truncated: boolean }> {
  const items: Report[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) query.set("cursor", cursor);
    const data: ReportList = await api<ReportList>(`/reports?${query}`, { signal });
    items.push(...data.items);
    if (!data.next_cursor) return { items, truncated: false };
    cursor = data.next_cursor;
  }
  return { items, truncated: true };
}

/** 대시보드와 제보 목록이 같은 캐시를 쓴다. 처리 상태를 바꾸면 ["reports"]를 무효화한다. */
export function useAllReports() {
  return useQuery({
    queryKey: ["reports", "all"],
    queryFn: ({ signal }) => fetchAllReports(signal),
  });
}

/** 같은 버그로 묶인 신고 수(원래 신고 포함). */
export function reportCount(report: Pick<Report, "duplicate_count">): number {
  return report.duplicate_count + 1;
}

export function needsInfo(report: Pick<Report, "latest_job">): boolean {
  return report.latest_job?.status === "needs_info";
}

type Hint = { text: string; tone: "muted" | "success" | "warning" | "faint" };

/** 목록 제목 아래 한 줄 안내. 다음에 할 일을 알려준다. */
export function reportHint(report: Report): Hint {
  switch (report.progress) {
    case "new":
      return { text: "재현 대기 중", tone: "muted" };
    case "reproducing":
      return { text: "자동 재현 진행 중", tone: "muted" };
    case "reproduced":
      return report.assignee
        ? { text: "재현 완료, 수정을 시작하면 ‘수정 중’으로 바꾸세요", tone: "muted" }
        : { text: "재현 완료, 담당자를 지정하세요", tone: "muted" };
    case "triaged":
      return needsInfo(report)
        ? { text: "추가 정보가 필요합니다", tone: "warning" }
        : { text: "시도했지만 같은 현상이 나오지 않음", tone: "muted" };
    case "fixing":
      return { text: "수정 배포 후 수정 확인을 실행하세요", tone: "success" };
    case "dismissed":
      return { text: "버그 아님·중복으로 종료", tone: "faint" };
    case "closed":
      return { text: "수정 확인을 통과해 마감됨", tone: "faint" };
    default:
      return { text: "", tone: "muted" };
  }
}

export const hintClass: Record<Hint["tone"], string> = {
  muted: "text-subtle",
  success: "text-primary",
  warning: "text-warning",
  faint: "text-faint",
};

/** 이번 주 월요일 00:00(브라우저 시간대). */
export function startOfWeek(now = new Date()): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (start.getDay() + 6) % 7; // 월요일 0
  start.setDate(start.getDate() - offset);
  return start;
}
