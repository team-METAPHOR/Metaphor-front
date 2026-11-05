// 실시간 재현 화면(WS /validation-jobs/{id}/live) 메시지 해석. 브라우저·React 없이 돌아가는 순수 함수만 둔다.
// 명세: Metaphor-back docs/api/live-preview.md, Core_engine docs/live-preview.md §3·§4.
// node scripts/check-live-frame.mjs 로 바로 확인할 수 있게 다른 모듈을 import 하지 않는다.

const MAX_HEADER_BYTES = 4096;
const MAX_JPEG_BYTES = 512 * 1024;

/** 엔진 progress/frame의 진행 정보. 값은 모두 엔진 enum이나 숫자다. */
export type LiveProgress = {
  attempt: number | null;
  revision: number | null;
  phase: string | null;
  step_index: number | null;
  action: string | null;
  total_steps: number | null;
};

type Common = { sequence: number; created_at: string; job_id: string; stream: number | null };

export type RelayState = {
  kind: "relay_state";
  job_id: string;
  job_status: string | null;
  preview: string;
  stream: number | null;
};

export type LiveMessage =
  | RelayState
  | { kind: "heartbeat" }
  | (Common & { kind: "status"; phase: string | null; step_index: number | null })
  | (Common & { kind: "progress"; progress: LiveProgress })
  | (Common & { kind: "preview_warning"; error_code: string | null })
  | (Common & { kind: "end"; status: string | null });

export type LiveFrame = Common & { progress: LiveProgress; width: number; height: number; jpeg: ArrayBuffer };

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function progressOf(data: Json): LiveProgress {
  return {
    attempt: int(data.attempt),
    revision: int(data.revision),
    phase: str(data.phase),
    step_index: int(data.step_index),
    action: str(data.action),
    total_steps: int(data.total_steps),
  };
}

function commonOf(meta: Json): Common | null {
  const sequence = int(meta.sequence);
  const createdAt = str(meta.created_at);
  const jobId = str(meta.job_id);
  if (sequence == null || createdAt == null || jobId == null) return null;
  return { sequence, created_at: createdAt, job_id: jobId, stream: int(meta.stream) };
}

/** text 메시지 하나를 해석한다. 모르는 kind·형식이 어긋난 메시지는 null(무시). */
export function parseLiveText(text: string): LiveMessage | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(raw)) return null;

  if (raw.schema_version === "live-relay-1") {
    if (raw.kind === "heartbeat") return { kind: "heartbeat" };
    const jobId = str(raw.job_id);
    const preview = str(raw.preview);
    if (raw.kind !== "relay_state" || jobId == null || preview == null) return null;
    return { kind: "relay_state", job_id: jobId, job_status: str(raw.job_status), preview, stream: int(raw.stream) };
  }

  if (raw.schema_version !== "live-1") return null;
  const common = commonOf(raw);
  const data = isObject(raw.data) ? raw.data : {};
  if (!common) return null;
  switch (raw.kind) {
    case "status":
      return { ...common, kind: "status", phase: str(data.phase), step_index: int(data.step_index) };
    case "progress":
      return { ...common, kind: "progress", progress: progressOf(data) };
    case "preview_warning":
      return { ...common, kind: "preview_warning", error_code: str(data.error_code) };
    case "end":
      return { ...common, kind: "end", status: str(data.status) };
    default:
      return null;
  }
}

/**
 * binary 프레임: 4바이트 big-endian 헤더 길이 + UTF-8 JSON 헤더 + JPEG.
 * 형식이 맞지 않으면 예외를 던진다(엔진 decoder 예제와 같은 검사).
 */
export function decodeLiveFrame(buffer: ArrayBuffer): LiveFrame {
  if (buffer.byteLength < 4) throw new Error("invalid frame");
  const size = new DataView(buffer).getUint32(0, false);
  if (size === 0 || size > MAX_HEADER_BYTES || 4 + size >= buffer.byteLength) throw new Error("invalid header");
  let meta: unknown;
  try {
    meta = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(buffer, 4, size)));
  } catch {
    throw new Error("invalid header");
  }
  const jpeg = buffer.slice(4 + size);
  if (!isObject(meta) || meta.schema_version !== "live-1" || meta.kind !== "frame" || !isObject(meta.data)) {
    throw new Error("invalid frame payload");
  }
  const data = meta.data;
  const common = commonOf(meta);
  const width = int(data.width);
  const height = int(data.height);
  if (
    !common ||
    data.mime_type !== "image/jpeg" ||
    data.bytes !== jpeg.byteLength ||
    jpeg.byteLength > MAX_JPEG_BYTES ||
    width == null ||
    height == null ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("invalid frame payload");
  }
  return { ...common, progress: progressOf(data), width, height, jpeg };
}

/** 연결이 닫힌 뒤 할 일. */
export type CloseAction =
  | "ended" // 1000 JOB_ENDED: 결과 API로 전환
  | "stop" // 1008 등: 다시 연결하지 않음
  | "new-ticket" // 4401 TICKET_INVALID: 새 티켓으로 한 번만 다시 연결
  | "login" // 4401 UNAUTHENTICATED: 로그인 화면
  | "hide" // 4404: 화면을 지우고 다시 연결하지 않음
  | "backoff"; // 4429·4408·1006 등: 제한된 backoff 뒤 새 티켓으로 다시 연결

export function closeAction(code: number, reason: string): CloseAction {
  if (code === 1000) return reason === "JOB_ENDED" ? "ended" : "backoff";
  if (code === 1008) return "stop";
  if (code === 4401) return reason === "TICKET_INVALID" ? "new-ticket" : "login";
  if (code === 4404) return "hide";
  return "backoff";
}

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

/** n번째(0부터) 재연결 대기 시간. 1초부터 두 배씩, 최대 30초. jitter는 0~1 사이 값. */
export function backoffDelay(failures: number, jitter: number): number {
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, failures));
  return Math.round(base * (0.75 + 0.25 * jitter));
}
