// 상태값 → 화면 표시. 모르는 값은 원문 그대로 neutral 톤으로 보여준다.

export type Tone = "neutral" | "info" | "progress" | "success" | "warning" | "danger";

type Entry = { label: string; tone: Tone };

export type Lookup = (value: string | null | undefined) => Entry;

function lookup(table: Record<string, Entry>, empty: Entry): Lookup {
  return (value) => {
    if (value == null || value === "") return empty;
    return table[value] ?? { label: value, tone: "neutral" };
  };
}

const none: Entry = { label: "-", tone: "neutral" };

/** 처리 상태: 사람이 정한다. closed는 재시험에서 재현되지 않으면 서버가 자동으로 바꾼다. */
export const workflowStatus = lookup(
  {
    received: { label: "신규", tone: "info" },
    fixing: { label: "수정 중", tone: "warning" },
    dismissed: { label: "버그 아님·중복", tone: "neutral" },
    closed: { label: "마감", tone: "success" },
  },
  none,
);

/** 진행 단계: 서버가 처리 상태와 최신 검증으로 계산한다. */
export const progress = lookup(
  {
    new: { label: "신규 신고", tone: "info" },
    reproducing: { label: "재현 중", tone: "progress" },
    reproduced: { label: "재현 완료", tone: "danger" },
    triaged: { label: "재현 완료(재현 안 됨)", tone: "neutral" },
    fixing: { label: "버그 수정 중", tone: "warning" },
    dismissed: { label: "버그 아님·중복", tone: "neutral" },
    closed: { label: "마감", tone: "success" },
  },
  none,
);

export const jobStatus = lookup(
  {
    queued: { label: "대기", tone: "neutral" },
    running: { label: "실행 중", tone: "progress" },
    cancelling: { label: "취소 중", tone: "warning" },
    needs_info: { label: "정보 필요", tone: "warning" },
    completed: { label: "완료", tone: "success" },
    inconclusive: { label: "판단 불가", tone: "warning" },
    failed: { label: "실패", tone: "danger" },
    cancelled: { label: "취소됨", tone: "neutral" },
  },
  { label: "실행 없음", tone: "neutral" },
);

/** not_reproduced는 "버그 없음"이 아니라 "재현 안 됨"이다. */
export const verdict = lookup(
  {
    reproduced: { label: "재현됨", tone: "danger" },
    not_reproduced: { label: "재현 안 됨", tone: "neutral" },
    inconclusive: { label: "판단 불가", tone: "warning" },
  },
  { label: "판정 전", tone: "neutral" },
);

export const reasonCode = lookup(
  {
    SYMPTOM_OBSERVED_TWICE: { label: "2회 모두 증상 관찰", tone: "danger" },
    SYMPTOM_NOT_OBSERVED_TWICE: { label: "2회 모두 증상 미관찰", tone: "neutral" },
    ATTEMPTS_DISAGREE: { label: "두 시도 결과가 다름", tone: "warning" },
    ATTEMPT_BLOCKED: { label: "시도가 막힘", tone: "warning" },
  },
  none,
);

export const jobStage = lookup(
  {
    received: { label: "접수", tone: "neutral" },
    interpreting: { label: "신고 해석", tone: "progress" },
    discovering: { label: "화면 탐색", tone: "progress" },
    planning: { label: "재현 계획", tone: "progress" },
    plan_rejected: { label: "계획 거부", tone: "warning" },
    running: { label: "재현 실행", tone: "progress" },
    replanning: { label: "계획 수정", tone: "progress" },
    retesting: { label: "재시험", tone: "progress" },
    reporting: { label: "보고서 작성", tone: "progress" },
  },
  none,
);

export const errorType = lookup(
  {
    manual: { label: "직접 신고", tone: "neutral" },
    js_error: { label: "JS 에러", tone: "neutral" },
    unhandled_rejection: { label: "Promise 에러", tone: "neutral" },
    http_5xx: { label: "서버 5xx", tone: "neutral" },
  },
  none,
);

export const classification = lookup(
  {
    functional: { label: "기능", tone: "neutral" },
    visual: { label: "화면 표시", tone: "neutral" },
    interaction: { label: "상호작용", tone: "neutral" },
    content: { label: "콘텐츠", tone: "neutral" },
    performance: { label: "성능", tone: "neutral" },
    compatibility: { label: "호환성", tone: "neutral" },
    needs_review: { label: "검토 필요", tone: "warning" },
  },
  { label: "미분류", tone: "neutral" },
);

export const source = lookup(
  {
    widget: { label: "위젯", tone: "neutral" },
    platform: { label: "플랫폼", tone: "neutral" },
  },
  none,
);

export const role = lookup(
  {
    developer: { label: "개발자", tone: "neutral" },
    reviewer: { label: "검토자", tone: "neutral" },
    admin: { label: "관리자", tone: "neutral" },
  },
  none,
);
