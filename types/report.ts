// Metaphor-back(app/models/*)와 Core_engine(qa_schema.py)에 정의된 값 기준.
// API 스키마에는 모두 string으로 나오므로, 모르는 값이 와도 화면이 깨지지 않게 처리해야 한다.

/** 처리 상태: 사람이 결정한다. */
export type WorkflowStatus = "received" | "in_review" | "accepted" | "closed";

/** 검증 job 실행 상태. */
export type JobStatus =
  | "queued"
  | "running"
  | "cancelling"
  | "needs_info"
  | "completed"
  | "inconclusive"
  | "failed"
  | "cancelled";

export type JobKind = "initial" | "fresh" | "resume" | "retest";

/** 재현 판정. null은 아직 판정 전. not_reproduced는 "버그 없음"이 아니다. */
export type Verdict = "reproduced" | "not_reproduced" | "inconclusive";

/** 신고 유입 경로. */
export type ReportSource = "platform" | "widget";

/** 신고 유형: 직접 신고 또는 자동 감지 종류. */
export type ErrorType = "manual" | "js_error" | "unhandled_rejection" | "http_5xx";

export type OriginKind = "approved" | "mapped";

/** AI 분류. */
export type Classification =
  | "functional"
  | "visual"
  | "interaction"
  | "content"
  | "performance"
  | "compatibility"
  | "needs_review";
