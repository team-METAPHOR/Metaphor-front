"use client";

import { ApiError, type Schemas } from "@/lib/api";
import { errorMessage } from "./ui";

type Program = Schemas["ProgramResponse"];
type ProgramCreate = Schemas["ProgramCreate"];
type ProgramPatch = Schemas["ProgramPatch"];
type Status = NonNullable<ProgramPatch["status"]>;

export const programStatuses: { value: Status; label: string }[] = [
  { value: "draft", label: "준비 중" },
  { value: "active", label: "운영 중" },
  { value: "paused", label: "일시 중지" },
  { value: "closed", label: "종료" },
];

export function programStatusLabel(status: string): string {
  return programStatuses.find((s) => s.value === status)?.label ?? status;
}

// 서버(app/schemas/program.py, core_engine BrowserOptions)와 같은 한도
const MAX_PREFIXES = 50;
const MAX_MASK_SELECTORS = 30;
const TOKEN = /^[A-Za-z0-9_.:-]{1,100}$/;
// 지원하는 초기화 방식(app/services/programs.py ALLOWED_RESET_ADAPTERS)
const RESET_ADAPTERS = [{ value: "stateless", label: "stateless (초기화 없음)" }];

/** 입력 중인 값. 목록은 줄마다 하나, 숫자는 문자열로 들고 있다. */
export type ProgramDraft = {
  name: string;
  status: Status;
  external_ai_allowed: boolean;
  auto_fresh_retries: string;
  base_url: string;
  allowed_path_prefixes: string;
  excluded_path_prefixes: string;
  width: string;
  height: string;
  app_version: string;
  approved_app_versions: string;
  test_context_id: string;
  mask_selectors: string;
  reset_adapter: string;
};

type Field = keyof ProgramDraft;
export type DraftErrors = Partial<Record<Field, string>>;

/** 새 사이트 기본값(ProgramCreate 기본값과 같다) */
export const emptyDraft: ProgramDraft = {
  name: "",
  status: "draft",
  external_ai_allowed: false,
  auto_fresh_retries: "1",
  base_url: "",
  allowed_path_prefixes: "/",
  excluded_path_prefixes: "",
  width: "1280",
  height: "800",
  app_version: "unspecified",
  approved_app_versions: "",
  test_context_id: "anonymous",
  mask_selectors: "",
  reset_adapter: "stateless",
};

export function draftFrom(program: Program): ProgramDraft {
  const { scope } = program;
  return {
    name: program.name,
    status: program.status as Status,
    external_ai_allowed: program.external_ai_allowed,
    auto_fresh_retries: String(program.auto_fresh_retries),
    base_url: scope.base_url,
    allowed_path_prefixes: scope.allowed_path_prefixes.join("\n"),
    excluded_path_prefixes: scope.excluded_path_prefixes.join("\n"),
    width: String(scope.width),
    height: String(scope.height),
    app_version: scope.app_version,
    approved_app_versions: scope.approved_app_versions.join("\n"),
    test_context_id: scope.test_context_id,
    mask_selectors: scope.mask_selectors.join("\n"),
    reset_adapter: scope.reset_adapter,
  };
}

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** scheme://host[:port] 이면 끝 슬래시 없는 origin을, 아니면 null */
export function originOf(input: string): string | null {
  const value = input.trim().replace(/\/$/, "");
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin.toLowerCase() === value.toLowerCase() ? url.origin : null;
  } catch {
    return null;
  }
}

function integer(value: string): number | null {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
}

type Parsed = Omit<ProgramCreate, "org_id">;

/** 서버와 같은 규칙으로 먼저 검사한다. 통과하면 보낼 값을, 아니면 필드별 오류를 돌려준다. */
export function parseDraft(draft: ProgramDraft): { value: Parsed; errors: null } | { value: null; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "이름을 입력하세요.";
  else if (name.length > 200) errors.name = "이름은 200자 이하여야 해요.";

  const origin = originOf(draft.base_url);
  if (!origin) errors.base_url = "경로 없이 scheme://host[:port] 형식으로 입력하세요. 예: https://shop.example.com";

  const allowed = lines(draft.allowed_path_prefixes);
  const excluded = lines(draft.excluded_path_prefixes);
  const prefixError = (list: string[]) =>
    list.length > MAX_PREFIXES
      ? `최대 ${MAX_PREFIXES}개까지 넣을 수 있어요.`
      : list.some((p) => !p.startsWith("/") || p.includes("?") || p.includes("#"))
        ? "경로는 /로 시작하고 ?나 #를 넣을 수 없어요."
        : undefined;
  if (allowed.length === 0) errors.allowed_path_prefixes = "허용 경로를 하나 이상 넣으세요. 전체는 / 예요.";
  else errors.allowed_path_prefixes = prefixError(allowed);
  errors.excluded_path_prefixes = prefixError(excluded);

  const retries = integer(draft.auto_fresh_retries);
  if (retries === null || retries > 2) errors.auto_fresh_retries = "0에서 2 사이로 입력하세요.";

  const width = integer(draft.width);
  const height = integer(draft.height);
  if (width === null || width < 320 || width > 1920) errors.width = "너비는 320~1920이어야 해요.";
  if (height === null || height < 320 || height > 1080) errors.height = "높이는 320~1080이어야 해요.";

  const tokenRule = "영문, 숫자, _ . : - 로 1~100자여야 해요.";
  const appVersion = draft.app_version.trim();
  if (!TOKEN.test(appVersion)) errors.app_version = tokenRule;
  const approved = lines(draft.approved_app_versions);
  if (approved.length > MAX_PREFIXES) errors.approved_app_versions = `최대 ${MAX_PREFIXES}개까지 넣을 수 있어요.`;
  else if (!approved.every((v) => TOKEN.test(v))) errors.approved_app_versions = `버전마다 ${tokenRule}`;
  const testContext = draft.test_context_id.trim();
  if (!TOKEN.test(testContext)) errors.test_context_id = tokenRule;

  const masks = lines(draft.mask_selectors);
  if (masks.length > MAX_MASK_SELECTORS) errors.mask_selectors = `최대 ${MAX_MASK_SELECTORS}개까지 넣을 수 있어요.`;
  else if (masks.some((m) => m.length > 256)) errors.mask_selectors = "선택자는 256자 이하여야 해요.";

  for (const key of Object.keys(errors) as Field[]) if (!errors[key]) delete errors[key];
  if (Object.keys(errors).length > 0) return { value: null, errors };

  return {
    errors: null,
    value: {
      name,
      status: draft.status,
      external_ai_allowed: draft.external_ai_allowed,
      auto_fresh_retries: retries!,
      base_url: origin!,
      allowed_path_prefixes: allowed,
      excluded_path_prefixes: excluded,
      width: width!,
      height: height!,
      app_version: appVersion,
      approved_app_versions: approved,
      test_context_id: testContext,
      mask_selectors: masks,
      reset_adapter: draft.reset_adapter,
    },
  };
}

/** 범위(scope) 필드. 하나라도 바뀌면 서버가 새 범위 리비전을 만든다. */
const scopeFields = [
  "base_url",
  "allowed_path_prefixes",
  "excluded_path_prefixes",
  "width",
  "height",
  "app_version",
  "approved_app_versions",
  "test_context_id",
  "mask_selectors",
  "reset_adapter",
] as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** 바뀐 필드만 담은 PATCH 본문. null은 넣지 않는다. */
export function diffPatch(program: Program, value: Parsed): ProgramPatch {
  const patch: ProgramPatch = {};
  const current = {
    name: program.name,
    status: program.status,
    external_ai_allowed: program.external_ai_allowed,
    auto_fresh_retries: program.auto_fresh_retries,
    ...program.scope,
  };
  for (const key of Object.keys(value) as (keyof Parsed)[]) {
    const next = value[key];
    if (key === "base_url") {
      if (originOf(current.base_url) !== next) patch.base_url = next as string;
    } else if (!same(current[key], next)) {
      (patch as Record<string, unknown>)[key] = next;
    }
  }
  return patch;
}

export function changesScope(patch: ProgramPatch): boolean {
  return scopeFields.some((field) => field in patch);
}

/** core_engine RunPolicy 오류 코드 */
const policyMessages: Record<string, string> = {
  INVALID_URL: "기본 URL이나 경로 형식이 올바르지 않아요. http(s) 주소인지, 공백이나 #이 없는지 확인하세요.",
  INVALID_HOST: "기본 URL의 도메인이 올바르지 않아요.",
  INVALID_PORT: "기본 URL의 포트가 올바르지 않아요(1~65535).",
  AMBIGUOUS_PATH: "경로에 //, ., .., % 같은 모호한 부분이 있어요.",
  SENSITIVE_QUERY_KEY: "주소에 토큰이나 비밀번호 같은 민감한 쿼리 키를 넣을 수 없어요.",
  BASE_URL_MUST_BE_ORIGIN: "기본 URL에는 경로나 쿼리 없이 도메인만 넣으세요. 예: https://shop.example.com",
  EMPTY_SCOPE: "허용 경로를 하나 이상 넣으세요.",
  INVALID_PATH_PREFIX: "경로는 /로 시작하고 ?나 #를 넣을 수 없어요.",
};

/** INVALID_RUN_OPTIONS 의 detail.reason */
const runOptionMessages: Record<string, string> = {
  "viewport must be between 320x320 and 1920x1080": "화면 크기는 320×320부터 1920×1080 사이여야 해요.",
  "invalid app version": "앱 버전은 영문, 숫자, _ . : - 로 1~100자여야 해요.",
  "invalid test context ID": "테스트 컨텍스트 ID는 영문, 숫자, _ . : - 로 1~100자여야 해요.",
  "invalid sensitive selectors": "가릴 요소 선택자는 30개 이하, 각각 1~256자여야 해요.",
  "invalid approved app version": "승인된 앱 버전은 각각 영문, 숫자, _ . : - 로 1~100자여야 해요.",
  "trusted session headers require an explicit synthetic test context ID":
    "로그인 세션이 연결된 사이트는 테스트 컨텍스트 ID를 anonymous가 아닌 값으로 정해야 해요.",
};

export function programErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "FORBIDDEN" || error.status === 403) return "관리자만 사이트를 등록하거나 바꿀 수 있어요.";
    if (error.code === "NOT_FOUND") return "사이트나 조직을 찾을 수 없어요. 새로고침 후 다시 시도하세요.";
    if (error.code === "VALIDATION_FAILED") return "입력값 형식이 올바르지 않아요. 비워 둔 필드나 범위를 벗어난 값이 있는지 확인하세요.";
    if (error.code === "RESET_ADAPTER_UNKNOWN") return "지원하지 않는 초기화 방식이에요.";
    if (error.code === "INVALID_RUN_OPTIONS") {
      const reason = (error.detail as { reason?: string } | null)?.reason;
      return (reason && runOptionMessages[reason]) ?? "실행 설정(화면 크기, 버전, 선택자)이 올바르지 않아요.";
    }
    if (policyMessages[error.code]) return policyMessages[error.code];
  }
  return errorMessage(error);
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary aria-invalid:border-red-400";

/** 등록·수정 폼이 함께 쓰는 입력 필드 */
export function ProgramFields({
  draft,
  errors,
  onChange,
}: {
  draft: ProgramDraft;
  errors: DraftErrors;
  onChange: (draft: ProgramDraft) => void;
}) {
  const set = <K extends Field>(key: K, value: ProgramDraft[K]) => onChange({ ...draft, [key]: value });
  const text = (key: Exclude<Field, "status" | "external_ai_allowed">, props: React.ComponentProps<"input"> = {}) => (
    <input
      id={`program-${key}`}
      value={draft[key]}
      onChange={(event) => set(key, event.target.value)}
      aria-invalid={errors[key] !== undefined}
      aria-describedby={errors[key] ? `program-${key}-error` : undefined}
      className={inputClass}
      {...props}
    />
  );
  const list = (key: Field, placeholder: string) => (
    <textarea
      id={`program-${key}`}
      value={draft[key] as string}
      onChange={(event) => set(key, event.target.value)}
      placeholder={placeholder}
      rows={3}
      aria-invalid={errors[key] !== undefined}
      aria-describedby={errors[key] ? `program-${key}-error` : undefined}
      className={`${inputClass} font-mono text-xs`}
    />
  );

  return (
    <div className="space-y-4">
      <Row field="name" label="이름" errors={errors}>
        {text("name", { placeholder: "예: 쇼핑몰 스테이징", maxLength: 200 })}
      </Row>
      <Row field="base_url" label="기본 URL" help="AI가 접속할 테스트 사이트 도메인이에요. 경로 없이 입력하세요." errors={errors}>
        {text("base_url", { placeholder: "https://shop.example.com", inputMode: "url", className: `${inputClass} font-mono text-xs` })}
      </Row>
      <Row field="allowed_path_prefixes" label="허용 경로" help="AI가 들어갈 수 있는 경로예요. 한 줄에 하나, 전체는 / 예요." errors={errors}>
        {list("allowed_path_prefixes", "/")}
      </Row>
      <Row field="excluded_path_prefixes" label="제외 경로" help="허용 경로 안에서 막을 경로예요. 한 줄에 하나." errors={errors}>
        {list("excluded_path_prefixes", "/admin")}
      </Row>
      <div className="grid gap-4 sm:grid-cols-2">
        <Row field="status" label="상태" errors={errors}>
          <select
            id="program-status"
            value={draft.status}
            onChange={(event) => set("status", event.target.value as Status)}
            className={inputClass}
          >
            {programStatuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Row>
        <Row field="auto_fresh_retries" label="자동 재생성 횟수" help="결론이 안 나면 시나리오를 새로 만들어 다시 돌려요(0~2)." errors={errors}>
          {text("auto_fresh_retries", { type: "number", min: 0, max: 2, step: 1 })}
        </Row>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.external_ai_allowed}
          onChange={(event) => set("external_ai_allowed", event.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="block font-medium">외부 AI 분석 허용</span>
          <span className="block text-xs text-muted">꺼져 있으면 신고를 받지 않고 AI 재현 검증도 하지 않아요.</span>
        </span>
      </label>
      {(draft.status !== "active" || !draft.external_ai_allowed) && (
        <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted">
          신고를 받으려면 상태가 운영 중이고 외부 AI 분석이 허용돼 있어야 해요.
        </p>
      )}

      <details className="rounded-lg border border-border px-4 py-3" open={hasAdvancedError(errors)}>
        <summary className="cursor-pointer text-sm font-medium">고급 설정</summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Row field="width" label="화면 너비" help="320~1920" errors={errors}>
              {text("width", { type: "number", min: 320, max: 1920 })}
            </Row>
            <Row field="height" label="화면 높이" help="320~1080" errors={errors}>
              {text("height", { type: "number", min: 320, max: 1080 })}
            </Row>
          </div>
          <Row field="app_version" label="앱 버전" help="테스트 대상 배포 버전이에요." errors={errors}>
            {text("app_version", { className: `${inputClass} font-mono text-xs` })}
          </Row>
          <Row field="approved_app_versions" label="승인된 앱 버전" help="재검증에 쓸 수 있는 배포 버전이에요. 한 줄에 하나." errors={errors}>
            {list("approved_app_versions", "1.4.2")}
          </Row>
          <Row field="test_context_id" label="테스트 컨텍스트 ID" help="테스트 계정·데이터 묶음 이름이에요. 없으면 anonymous." errors={errors}>
            {text("test_context_id", { className: `${inputClass} font-mono text-xs` })}
          </Row>
          <Row field="mask_selectors" label="가릴 요소" help="스크린샷에서 가릴 CSS 선택자예요. 한 줄에 하나, 최대 30개." errors={errors}>
            {list("mask_selectors", "#card-number")}
          </Row>
          <Row field="reset_adapter" label="초기화 방식" errors={errors}>
            <select
              id="program-reset_adapter"
              value={draft.reset_adapter}
              onChange={(event) => set("reset_adapter", event.target.value)}
              className={inputClass}
            >
              {RESET_ADAPTERS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
              {!RESET_ADAPTERS.some((r) => r.value === draft.reset_adapter) && (
                <option value={draft.reset_adapter}>{draft.reset_adapter}</option>
              )}
            </select>
          </Row>
        </div>
      </details>
    </div>
  );
}

const advancedFields: Field[] = ["width", "height", "app_version", "approved_app_versions", "test_context_id", "mask_selectors"];
const hasAdvancedError = (errors: DraftErrors) => advancedFields.some((f) => errors[f]);

function Row({
  field,
  label,
  help,
  errors,
  children,
}: {
  field: Field;
  label: string;
  help?: string;
  errors: DraftErrors;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`program-${field}`} className="block text-sm font-medium">
        {label}
      </label>
      {help && <p className="mt-0.5 text-xs text-muted">{help}</p>}
      <div className="mt-1.5">{children}</div>
      {errors[field] && (
        <p id={`program-${field}-error`} role="alert" className="mt-1 text-xs text-danger">
          {errors[field]}
        </p>
      )}
    </div>
  );
}
