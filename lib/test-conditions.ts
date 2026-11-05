"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type Schemas } from "@/lib/api";

type ConditionList = Schemas["TestConditionList"];
export type Browser = Schemas["TestConditionCreate"]["browser_name"];

/** 사이트 하나에 등록할 수 있는 조건 수(서버 한도). */
export const MAX_CONDITIONS = 16;
/** 재현 한 번에 고를 수 있는 조건 수(서버 한도). */
export const MAX_CONDITIONS_PER_RUN = 8;
/** AI 자동 선택의 기본 개수. */
export const AUTO_SELECT_DEFAULT = 4;

export const conditionsKey = (programId: string) => ["programs", programId, "test-conditions"] as const;

/** 사이트에 등록한 테스트 조건. viewer도 읽을 수 있다. */
export function useTestConditions(programId: string | undefined) {
  return useQuery({
    queryKey: conditionsKey(programId ?? ""),
    queryFn: ({ signal }) =>
      api<ConditionList>(`/programs/${encodeURIComponent(programId!)}/test-conditions`, { signal }),
    enabled: programId != null,
  });
}

export const BROWSERS: { value: Browser; label: string }[] = [
  { value: "chromium", label: "Chrome" },
  { value: "firefox", label: "Firefox" },
  { value: "webkit", label: "Safari" },
];

export function browserLabel(name: string): string {
  return BROWSERS.find((browser) => browser.value === name)?.label ?? name;
}

type ConditionFields = {
  browser_name: string;
  width: number;
  height: number;
  response_delay_ms: number;
  test_context_id: string;
};

/** "Safari · 390×844 · 계정 staff-1 · 응답 지연 800ms". 익명 계정과 지연 0은 뺀다. */
export function conditionSummary(condition: ConditionFields): string {
  return [
    browserLabel(condition.browser_name),
    `${condition.width}×${condition.height}`,
    condition.test_context_id !== "anonymous" ? `계정 ${condition.test_context_id}` : null,
    condition.response_delay_ms > 0 ? `응답 지연 ${condition.response_delay_ms}ms` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
