// Metaphor-back(app/models/*, app/services/*)와 Core_engine(qa_schema.py, verdict.py, qa.py)에
// 정의된 값 기준. API 스펙에는 대부분 string으로 나오므로, 모르는 값이 와도 화면이 깨지지 않게
// 처리해야 한다(lib/labels.ts 참고).

/** 조직 내 역할. */
export type Role = "developer" | "viewer" | "admin";

/** 처리 상태: 사람이 결정한다. closed는 수정 확인 통과(fix_verified) 뒤에만 고를 수 있다. */
export type WorkflowStatus = "received" | "fixing" | "dismissed" | "closed";

/** 언제든 바꿀 수 있는 처리 상태(PATCH /reports/{id}/workflow). closed는 fix_verified일 때만 더한다. */
export const SETTABLE_WORKFLOW_STATUSES = ["received", "fixing", "dismissed"] as const;

/** 진행 단계: 처리 상태와 최신 job으로 서버가 계산한다. */
export type Progress =
  | "new"
  | "reproducing"
  | "reproduced"
  | "triaged"
  | "verified"
  | "waiting_quota"
  | "fixing"
  | "dismissed"
  | "closed";

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

/** 아직 끝나지 않아 폴링이 필요한 상태. */
export const ACTIVE_JOB_STATUSES: readonly string[] = ["queued", "running", "cancelling"];

export type JobKind = "initial" | "fresh" | "resume" | "retest";

/** 실행 중 단계. 엔진 이벤트 kind와 같고, 끝나면 최종 status가 들어간다. */
export type JobStage =
  | "received"
  | "interpreting"
  | "discovering"
  | "planning"
  | "plan_rejected"
  | "running"
  | "replanning"
  | "retesting"
  | "reporting";

/** 재현 판정. null은 아직 판정 전. not_reproduced는 "버그 없음"이 아니다. */
export type Verdict = "reproduced" | "not_reproduced" | "inconclusive";

/** 판정 사유. */
export type ReasonCode =
  | "SYMPTOM_OBSERVED_TWICE"
  | "SYMPTOM_NOT_OBSERVED_TWICE"
  | "ATTEMPTS_DISAGREE"
  | "ATTEMPT_BLOCKED";

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

export type ArtifactKind = "input_image" | "report_md" | "screenshot" | "json" | "video" | "playwright_spec";

/** ReportDetail.client_context 구조 (위젯 신고). */
export type ClientContext = {
  reported_url?: string;
  query_stripped?: boolean;
  error?: {
    message: string;
    stack_top: string | null;
    http: { method: string; path: string; status: number } | null;
  };
  environment?: {
    user_agent: string;
    language: string;
    timezone: string;
    viewport: { width: number; height: number } | null;
  };
};

/**
 * JobResult.result 중 화면에 쓰는 부분 (엔진 결과 원본, 서버에서 PII 제거됨).
 * 필드가 빠져 있을 수 있으므로 모두 optional로 다룬다.
 */
export type EngineResult = {
  status?: string;
  error_code?: string | null;
  questions?: string[];
  report?: {
    title?: string;
    classification?: string;
    regression?: string | null;
    environment?: { width: number; height: number; app_version: string; test_context_id?: string };
    intake?: {
      expected_behavior: string;
      expectation_source: string;
      symptom_description: string;
      observed_facts: string[];
    };
    scenario?: {
      steps: { action: "navigate" | "click" | "fill" | "assert_text" | string; target: string; value: string }[];
      ready: unknown;
      expected: unknown;
      symptom: unknown;
    };
    run?: {
      verdict: { value: Verdict | string; reason_code: ReasonCode | string };
      evidence: {
        id: string;
        attempt: number;
        completed_steps: number;
        symptom_observed: boolean | null;
        expected_observed: boolean | null;
        blocker: string | null;
      }[];
    };
  };
};
