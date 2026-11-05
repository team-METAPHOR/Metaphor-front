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
    verified: { label: "수정 확인됨", tone: "success" },
    waiting_quota: { label: "한도 대기", tone: "warning" },
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

/**
 * 서버가 붙이는 필요 조치(required_actions) 코드 → 짧은 이름과 사람이 할 일.
 * Metaphor-back app/services/report_actions.py의 ACTION_MESSAGES 기준. 모르는 코드는 서버 메시지를 쓴다.
 */
const REQUIRED_ACTIONS: Record<string, { title: string; text: string }> = {
  VERIFY_ORIGIN: { title: "도메인 소유 확인", text: "테스트 대상 도메인의 소유 확인이 필요해요." },
  WAIT_FOR_QUOTA: { title: "실행 한도 대기", text: "오늘 실행 한도에 도달했어요. 한도가 풀리면 다시 시도해요." },
  TEST_ACCOUNT_REQUIRED: { title: "테스트 계정 다시 저장", text: "저장된 테스트 계정을 쓸 수 없어요. 계정을 다시 저장하세요." },
  CHECK_TEST_ACCOUNT: { title: "테스트 계정 확인", text: "테스트 계정으로 로그인하지 못했어요. 계정과 로그인 설정을 확인하세요." },
  CHECK_TARGET_URL: { title: "재현 대상 주소 확인", text: "재현 대상 주소가 허용 범위를 벗어났거나 열리지 않아요. 사이트 설정을 확인하세요." },
  USE_HTTPS_FOR_CREDENTIALS: { title: "HTTPS 주소 사용", text: "로그인이 필요한 재현은 HTTPS 주소에서만 할 수 있어요." },
  ANSWER_QUESTIONS: { title: "질문에 답하기", text: "AI의 추가 질문에 답하면 다시 재현해요." },
  WAIT_FOR_PROVIDER: { title: "AI 사용량 제한", text: "AI 사용량 제한이 풀린 뒤 다시 재현하세요." },
  RETRY_PROVIDER_LATER: { title: "잠시 후 다시 재현", text: "AI 응답이 일시적으로 실패했어요. 잠시 후 다시 재현하세요." },
  OPERATOR_CHECK_PROVIDER: { title: "운영자 확인 필요", text: "AI 공급자 설정 문제로 멈췄어요. 운영자에게 문의하세요." },
};

export function requiredAction(action: { code: string; message: string }): string {
  return REQUIRED_ACTIONS[action.code]?.text ?? action.message;
}

export function requiredActionTitle(code: string): string {
  return REQUIRED_ACTIONS[code]?.title ?? "필요한 조치";
}

/** 작업 error_code(엔진·워커) → 멈춘 이유 한 문장. 모르는 코드는 null. */
const JOB_ERRORS: [string[], string][] = [
  [["LOGIN_FAILED"], "테스트 계정으로 로그인하지 못했어요."],
  [["CREDENTIALS_REQUIRE_HTTPS"], "HTTP 주소에서는 테스트 계정을 쓸 수 없어요."],
  [
    ["TEST_ACCOUNT_INVALID", "TEST_ACCOUNT_KEY_MISSING", "TEST_ACCOUNT_KEY_INVALID", "SESSION_SECRET_MISSING", "SESSION_SECRET_INVALID"],
    "저장된 테스트 계정을 쓸 수 없어요.",
  ],
  [["NAVIGATION_FAILED"], "대상 페이지를 열지 못했어요."],
  [["DNS_FAILED"], "대상 주소를 찾지 못했어요."],
  [
    ["ORIGIN_OUT_OF_SCOPE", "PATH_OUT_OF_SCOPE", "PATH_EXCLUDED", "INVALID_URL", "INVALID_HOST", "DESTINATION_BLOCKED", "PRIVATE_DESTINATION_BLOCKED"],
    "대상 주소가 허용 범위를 벗어났어요.",
  ],
  [["ORIGIN_NOT_VERIFIED"], "대상 도메인의 소유 확인이 안 됐어요."],
  [["MODEL_RATE_LIMITED"], "AI 사용량 제한에 걸렸어요."],
  [["MODEL_TIMEOUT", "MODEL_UNAVAILABLE", "MODEL_HTTP_ERROR"], "AI 응답이 일시적으로 실패했어요."],
  [["MODEL_AUTH_FAILED", "MODEL_RESPONSE_TOO_LARGE"], "AI 공급자 설정 문제로 멈췄어요."],
];

export function jobErrorReason(code: string | null | undefined): string | null {
  if (!code) return null;
  return JOB_ERRORS.find(([codes]) => codes.includes(code))?.[1] ?? null;
}

export const role = lookup(
  {
    developer: { label: "개발자", tone: "neutral" },
    viewer: { label: "열람자", tone: "neutral" },
    admin: { label: "관리자", tone: "neutral" },
  },
  none,
);
