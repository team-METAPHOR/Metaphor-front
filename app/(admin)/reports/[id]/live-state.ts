// 실시간 재현 화면(WS /validation-jobs/{id}/live)의 메시지 해석과 상태 전이.
// React와 무관한 순수 함수만 둔다. 명세: Metaphor-back docs/api/live-preview.md, Core_engine docs/live-preview.md

/** 백엔드 relay_state.preview */
export type Preview =
  | "queued"
  | "starting"
  | "waiting"
  | "live"
  | "disabled"
  | "relay_unavailable"
  | "worker_lost"
  | "cancelling"
  | "ended";

/** 재접속하지 않고 멈춘 이유 */
export type Stopped = "ended" | "unauthenticated" | "not_found" | "rejected" | "gave_up";

export type Progress = {
  attempt: number;
  revision: number | null;
  phase: string;
  step_index: number | null;
  action: string | null;
  total_steps: number | null;
};

export type Frame = {
  url: string;
  sequence: number;
  width: number;
  height: number;
  /** 브라우저가 받은 시각(ms). 서버 시계와 어긋나도 "몇 초 전"이 틀리지 않게 받은 시각을 쓴다. */
  receivedAt: number;
};

export type LiveState = {
  /** connecting: 첫 연결, open: 연결됨, reconnecting: 끊겨서 다시 붙는 중, stopped: 재접속 안 함 */
  connection: "connecting" | "open" | "reconnecting" | "stopped";
  stopped: Stopped | null;
  /** 4429: 동시 연결 수 초과로 잠시 뒤 다시 붙는 중 */
  tooMany: boolean;
  preview: Preview | null;
  stream: number | null;
  conditionId: string | null;
  /** 지금 스트림에서 처리한 마지막 text 메시지 sequence. 이하 번호는 버린다. */
  cursor: number;
  /** 화면을 마지막으로 비운 sequence(attempt_started). 이보다 앞선 화면은 늦게 도착해도 버린다. */
  clearedAt: number;
  /** 엔진 status.phase (interpreting, planning, running …) */
  status: string | null;
  progress: Progress | null;
  /** status와 progress 중 나중에 온 쪽. 단계 표시는 이것을 따른다. */
  lastKind: "status" | "progress" | null;
  frame: Frame | null;
  /** 엔진이 실행을 끝냈다(kind=end). 결과 저장은 relay_state ended를 기다린다. */
  engineEnded: boolean;
};

export const initialLiveState: LiveState = {
  connection: "connecting",
  stopped: null,
  tooMany: false,
  preview: null,
  stream: null,
  conditionId: null,
  cursor: 0,
  clearedAt: 0,
  status: null,
  progress: null,
  lastKind: null,
  frame: null,
  engineEnded: false,
};

type EngineMeta = {
  schema_version: "live-1";
  kind: "status" | "progress" | "frame" | "preview_warning" | "end";
  sequence: number;
  stream?: number;
  condition_id?: string | null;
  data: Record<string, unknown>;
};

export type LiveAction =
  | { type: "open" }
  | { type: "relay"; preview: Preview; stream: number | null; conditionId: string | null }
  | { type: "engine"; meta: EngineMeta }
  | { type: "frame"; frame: Frame; stream: number | null }
  | { type: "reconnecting"; tooMany: boolean }
  | { type: "stop"; reason: Stopped }
  | { type: "retry" };

/** 화면을 비워야 하는 relay 상태. relay_unavailable은 마지막 화면을 남겨도 된다. */
const CLEARS_FRAME: Preview[] = ["queued", "starting", "worker_lost", "cancelling", "ended", "disabled"];

/** 다른 스트림(새 조건·재검증)으로 넘어가면 이전 화면과 단계를 지운다. */
function enterStream(state: LiveState, stream: number | null, conditionId: string | null): LiveState {
  if (stream == null || stream === state.stream) return { ...state, conditionId: conditionId ?? state.conditionId };
  return {
    ...state,
    stream,
    conditionId,
    cursor: 0,
    clearedAt: 0,
    status: null,
    progress: null,
    lastKind: null,
    frame: null,
    engineEnded: false,
  };
}

export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case "open":
      return { ...state, connection: "open", tooMany: false };
    case "relay": {
      const next = enterStream({ ...state, preview: action.preview }, action.stream, action.conditionId);
      return CLEARS_FRAME.includes(action.preview) ? { ...next, frame: null } : next;
    }
    case "engine": {
      const { meta } = action;
      const next = enterStream(state, meta.stream ?? null, meta.condition_id ?? null);
      if (meta.sequence <= next.cursor) return next;
      const advanced = { ...next, cursor: meta.sequence };
      if (meta.kind === "status") {
        return { ...advanced, status: typeof meta.data.phase === "string" ? meta.data.phase : null, lastKind: "status" };
      }
      if (meta.kind === "progress") {
        const progress = toProgress(meta.data);
        if (!progress) return advanced;
        // 새 시도는 새 브라우저다. 이전 시도 화면을 지금 화면처럼 보이지 않게 한다(엔진 규칙).
        if (progress.phase === "attempt_started") {
          return { ...advanced, progress, lastKind: "progress", frame: null, clearedAt: meta.sequence };
        }
        return { ...advanced, progress, lastKind: "progress" };
      }
      if (meta.kind === "end") return { ...advanced, engineEnded: true };
      return advanced;
    }
    case "frame": {
      // 화면은 디코딩을 기다리느라 text보다 늦게 올 수 있다. text cursor가 아니라 지금 화면과 비운 시점만 비교한다.
      const next = enterStream(state, action.stream, state.conditionId);
      const { sequence } = action.frame;
      if (sequence <= next.clearedAt || sequence <= (next.frame?.sequence ?? 0)) return next;
      return { ...next, frame: action.frame };
    }
    case "reconnecting":
      return { ...state, connection: "reconnecting", tooMany: action.tooMany };
    case "stop": {
      // 권한이 없어졌으면 이미 받은 화면도 지운다.
      const clear = action.reason !== "gave_up";
      return { ...state, connection: "stopped", stopped: action.reason, frame: clear ? null : state.frame };
    }
    case "retry":
      return { ...state, connection: "connecting", stopped: null, tooMany: false };
  }
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toProgress(data: Record<string, unknown>): Progress | null {
  const attempt = num(data.attempt);
  if (attempt == null || typeof data.phase !== "string") return null;
  return {
    attempt,
    revision: num(data.revision),
    phase: data.phase,
    step_index: num(data.step_index),
    action: typeof data.action === "string" ? data.action : null,
    total_steps: num(data.total_steps),
  };
}

// ---------------------------------------------------------------- 메시지 해석

export type Incoming =
  | { kind: "relay_state"; preview: Preview; stream: number | null; conditionId: string | null }
  | { kind: "heartbeat" }
  | { kind: "engine"; meta: EngineMeta }
  | null;

const PREVIEWS: Preview[] = [
  "queued",
  "starting",
  "waiting",
  "live",
  "disabled",
  "relay_unavailable",
  "worker_lost",
  "cancelling",
  "ended",
];
const ENGINE_KINDS = ["status", "progress", "preview_warning", "end"];

/** text 메시지. 모르는 형식은 null(무시). */
export function parseText(text: string): Incoming {
  let message: unknown;
  try {
    message = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof message !== "object" || message === null) return null;
  const m = message as Record<string, unknown>;
  if (m.schema_version === "live-relay-1") {
    if (m.kind === "heartbeat") return { kind: "heartbeat" };
    if (m.kind === "relay_state" && PREVIEWS.includes(m.preview as Preview)) {
      return {
        kind: "relay_state",
        preview: m.preview as Preview,
        stream: num(m.stream),
        conditionId: typeof m.condition_id === "string" ? m.condition_id : null,
      };
    }
    return null;
  }
  if (
    m.schema_version === "live-1" &&
    ENGINE_KINDS.includes(m.kind as string) &&
    num(m.sequence) != null &&
    typeof m.data === "object" &&
    m.data !== null
  ) {
    return { kind: "engine", meta: m as unknown as EngineMeta };
  }
  return null;
}

const MAX_HEADER = 4096;
const MAX_JPEG = 512 * 1024;

export type DecodedFrame = {
  sequence: number;
  stream: number | null;
  width: number;
  height: number;
  jpeg: ArrayBuffer;
};

/**
 * binary 메시지: 4바이트 big-endian 헤더 길이 + UTF-8 JSON 헤더 + JPEG.
 * 엔진 decoder 예제와 같은 검사를 한다. 형식이 틀리면 null.
 */
export function decodeFrame(buffer: ArrayBuffer): DecodedFrame | null {
  if (buffer.byteLength < 4) return null;
  const size = new DataView(buffer).getUint32(0, false);
  if (size > MAX_HEADER || 4 + size >= buffer.byteLength) return null;
  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(new TextDecoder().decode(buffer.slice(4, 4 + size)));
  } catch {
    return null;
  }
  const jpeg = buffer.slice(4 + size);
  const data = (meta.data ?? {}) as Record<string, unknown>;
  const sequence = num(meta.sequence);
  if (
    meta.schema_version !== "live-1" ||
    meta.kind !== "frame" ||
    sequence == null ||
    data.mime_type !== "image/jpeg" ||
    data.bytes !== jpeg.byteLength ||
    jpeg.byteLength > MAX_JPEG
  ) {
    return null;
  }
  return {
    sequence,
    stream: num(meta.stream),
    width: num(data.width) ?? 16,
    height: num(data.height) ?? 10,
    jpeg,
  };
}

// ---------------------------------------------------------------- 재접속

/** 닫힘 코드별 처리. 명세 표 그대로. */
export function closeOutcome(code: number): { stop: Stopped } | { retry: true; tooMany: boolean } {
  if (code === 1000) return { stop: "ended" };
  if (code === 1008) return { stop: "rejected" };
  if (code === 4401) return { stop: "unauthenticated" };
  if (code === 4404) return { stop: "not_found" };
  return { retry: true, tooMany: code === 4429 };
}

export const MAX_RETRIES = 6;

/** 1, 2, 4, 8, 15, 15초. 4429는 다른 탭이 닫히길 기다리므로 더 길게. */
export function backoffMs(attempt: number, tooMany: boolean): number {
  const base = Math.min(1000 * 2 ** attempt, 15_000);
  return tooMany ? Math.max(base, 10_000) : base;
}

// ---------------------------------------------------------------- 화면 문구

/** 진행 막대의 6단계 */
export const STAGES = ["제보 해석", "화면 관찰", "계획 작성", "실행", "결과 확인", "보고서 생성"] as const;

const STATUS_STAGE: Record<string, number> = {
  received: 0,
  interpreting: 0,
  discovering: 1,
  planning: 2,
  plan_rejected: 2,
  replanning: 2,
  running: 3,
  retesting: 3,
  reporting: 5,
};

const CHECKING_PHASES = ["outcome", "completed", "attempt_finished", "attempt_failed"];

/** 지금 단계(0~5). 알 수 없으면 null. */
export function stageOf(state: Pick<LiveState, "status" | "progress" | "lastKind">): number | null {
  const fromStatus = state.status != null ? STATUS_STAGE[state.status] ?? null : null;
  if (state.lastKind === "status" || !state.progress) return fromStatus;
  const { attempt, phase } = state.progress;
  if (attempt === 0) return 1;
  return CHECKING_PHASES.includes(phase) ? 4 : 3;
}

export const ACTION_LABEL: Record<string, string> = {
  navigate: "이동",
  click: "클릭",
  fill: "입력",
  assert_text: "확인",
};

/** "시도 1", "3 / 7단계", "클릭". 엔진이 준 값만 쓴다. */
export function progressChips(progress: Progress | null): string[] {
  if (!progress) return [];
  const chips: string[] = [];
  if (progress.attempt === 0) chips.push("최초 화면 관찰");
  else chips.push(`시도 ${progress.attempt}`);
  if (progress.phase === "login") {
    chips.push("로그인");
    return chips;
  }
  if (progress.step_index != null) {
    const step = progress.step_index + 1;
    chips.push(progress.total_steps != null ? `${step} / ${progress.total_steps}단계` : `${step}단계`);
  }
  if (progress.action) chips.push(ACTION_LABEL[progress.action] ?? progress.action);
  return chips;
}
