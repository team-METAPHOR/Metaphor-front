"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { meQueryKey } from "@/lib/auth";
import { ApiError, api, type Schemas } from "@/lib/api";
import {
  backoffDelay,
  closeAction,
  decodeLiveFrame,
  parseLiveText,
  type LiveMessage,
  type LiveProgress,
} from "./live-frame";
import { reportKeys } from "./queries";

type Ticket = Schemas["LiveTicketOut"];

/** 연결 상태. preview(서버 중계 상태)와 따로 둔다. */
export type LiveConnection =
  | "connecting" // 티켓 발급·handshake 중
  | "open" // 연결됨. 화면 상태는 preview로 본다
  | "reconnecting" // 끊겨서 backoff 뒤 다시 연결
  | "paused" // 탭이 숨겨져 연결을 닫음
  | "ended" // 작업 종료(1000 JOB_ENDED)
  | "failed"; // 다시 연결하지 않음(설정 오류, 재시도 한도)

export type LiveFrameView = {
  url: string;
  sequence: number;
  createdAt: string;
  width: number;
  height: number;
  /** 연결이 끊기거나 중계 장애라 지금 화면이 아닐 수 있다 */
  stale: boolean;
};

export type LivePreviewState = {
  connection: LiveConnection;
  /** relay_state.preview. 아직 받지 못했으면 null */
  preview: string | null;
  /** status.phase (작업 단계: interpreting, planning ...) */
  stage: string | null;
  progress: LiveProgress | null;
  frame: LiveFrameView | null;
  /** 엔진 kind=end를 받음. 결과 저장을 기다리는 중 */
  engineEnded: boolean;
  warning: string | null;
  /** 404: 패널을 숨긴다 */
  hidden: boolean;
};

const INITIAL: LivePreviewState = {
  connection: "connecting",
  preview: null,
  stage: null,
  progress: null,
  frame: null,
  engineEnded: false,
  warning: null,
  hidden: false,
};

/** 중계 상태가 이 값이면 이전 화면을 지운다(취소·워커 종료·대기 등). relay_unavailable은 마지막 화면으로 남긴다. */
const KEEP_FRAME_PREVIEWS = ["live", "waiting", "relay_unavailable"];
/** heartbeat가 15초마다 오므로 이만큼 아무것도 없으면 끊긴 것으로 본다. */
const SILENCE_MS = 40_000;
/** 연속 실패가 이만큼이면 멈추고 "다시 연결" 버튼을 보인다. */
const MAX_FAILURES = 8;
/** 429 LIVE_TICKET_THROTTLED: Retry-After가 없으니 수십 초 기다린다. */
const THROTTLE_MS = 30_000;

function sameOriginUrl(jobId: string): string {
  return `${location.origin.replace(/^http/, "ws")}/api/v1/validation-jobs/${encodeURIComponent(jobId)}/live`;
}

/**
 * 실행 중인 작업의 실시간 재현 화면(관찰 전용).
 * 연결마다 일회용 티켓을 새로 받는다. 티켓은 이 함수 안의 지역 변수로만 쓰고 상태·로그에 남기지 않는다.
 * 최신 화면 한 장만 Blob URL로 들고 있고, 바뀌거나 언마운트하면 해제한다.
 * jobId가 바뀌면 key로 컴포넌트를 새로 마운트하는 것을 전제로 한다.
 */
export function useLivePreview(reportId: string, jobId: string): LivePreviewState & { retry: () => void } {
  const client = useQueryClient();
  const [state, setState] = useState<LivePreviewState>(INITIAL);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let abort: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let stopped = false;
    let failures = 0;
    let ticketRetried = false;
    let lastMessageAt = 0;
    // 스트림 안에서만 증가하는 sequence 커서. 스트림이 바뀌면 처음부터.
    let stream: number | null = null;
    let cursor = 0;

    const update = (patch: (prev: LivePreviewState) => Partial<LivePreviewState>) => {
      if (!disposed) setState((prev) => ({ ...prev, ...patch(prev) }));
    };
    const staleFrame = (frame: LiveFrameView | null) => (frame ? { ...frame, stale: true } : null);

    const closeSocket = () => {
      abort?.abort();
      abort = null;
      if (timer) clearTimeout(timer);
      timer = null;
      if (socket) {
        socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
        socket.close(1000);
        socket = null;
      }
    };

    const stop = (patch: Partial<LivePreviewState> | ((prev: LivePreviewState) => Partial<LivePreviewState>)) => {
      stopped = true;
      closeSocket();
      update(typeof patch === "function" ? patch : () => patch);
    };

    const login = () => {
      stop({ connection: "failed", frame: null });
      // AuthGate가 /auth/me를 다시 받아 401이면 로그인 화면으로 보낸다.
      void client.invalidateQueries({ queryKey: meQueryKey });
    };

    const schedule = (minDelay = 0) => {
      closeSocket();
      if (failures >= MAX_FAILURES) {
        stop((prev) => ({ connection: "failed", frame: staleFrame(prev.frame) }));
        return;
      }
      const delay = Math.max(minDelay, backoffDelay(failures, Math.random()));
      failures += 1;
      update((prev) => ({ connection: "reconnecting", frame: staleFrame(prev.frame) }));
      timer = setTimeout(() => void connect(), delay);
    };

    /** 다른 스트림(조건 전환·재검증)의 메시지면 커서와 화면·단계를 비운다. */
    const enterStream = (next: number | null) => {
      if (next == null || next === stream) return;
      stream = next;
      cursor = 0;
      update(() => ({ frame: null, progress: null, stage: null, engineEnded: false, warning: null }));
    };

    const handleText = (message: LiveMessage) => {
      if (message.kind === "heartbeat") return;
      if (message.job_id !== jobId) return;
      if (message.kind === "relay_state") {
        enterStream(message.stream);
        update((prev) => ({
          preview: message.preview,
          frame: KEEP_FRAME_PREVIEWS.includes(message.preview)
            ? message.preview === "live"
              ? prev.frame && { ...prev.frame, stale: false }
              : staleFrame(prev.frame)
            : null,
        }));
        return;
      }
      enterStream(message.stream);
      if (message.sequence <= cursor) return;
      cursor = message.sequence;
      switch (message.kind) {
        case "status":
          update(() => ({ stage: message.phase }));
          break;
        case "progress":
          // 새 시도가 시작되면 이전 시도의 화면은 지운다(엔진 규칙).
          update((prev) => ({
            progress: message.progress,
            frame: message.progress.phase === "attempt_started" ? null : prev.frame,
          }));
          break;
        case "preview_warning":
          update(() => ({ warning: message.error_code }));
          break;
        case "end":
          update(() => ({ engineEnded: true }));
          break;
      }
    };

    const handleFrame = (buffer: ArrayBuffer) => {
      let frame;
      try {
        frame = decodeLiveFrame(buffer);
      } catch {
        return; // 깨진 프레임은 버린다.
      }
      if (frame.job_id !== jobId) return;
      enterStream(frame.stream);
      if (frame.sequence <= cursor) return;
      cursor = frame.sequence;
      const url = URL.createObjectURL(new Blob([frame.jpeg], { type: "image/jpeg" }));
      if (disposed) {
        URL.revokeObjectURL(url);
        return;
      }
      // 이전 URL은 아래 effect가 새 화면을 그린 뒤 해제한다.
      setState((prev) => ({
        ...prev,
        progress: frame.progress,
        frame: { url, sequence: frame.sequence, createdAt: frame.created_at, width: frame.width, height: frame.height, stale: false },
      }));
    };

    const connect = async () => {
      if (disposed || stopped) return;
      closeSocket();
      update((prev) => ({ connection: prev.connection === "reconnecting" ? "reconnecting" : "connecting" }));
      const controller = new AbortController();
      abort = controller;
      let ticket: Ticket;
      try {
        ticket = await api<Ticket>(`/validation-jobs/${encodeURIComponent(jobId)}/live-ticket`, {
          method: "POST",
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted || disposed) return;
        const status = error instanceof ApiError ? error.status : null;
        if (status === 401) return login();
        if (status === 404) return stop({ hidden: true, frame: null });
        if (status === 403) return stop({ connection: "failed" });
        return schedule(status === 429 ? THROTTLE_MS : 0);
      }
      if (controller.signal.aborted || disposed) return;
      abort = null;

      const ws = new WebSocket(ticket.websocket_url ?? sameOriginUrl(jobId), [
        ticket.subprotocol,
        `ticket.${ticket.ticket}`,
      ]);
      ws.binaryType = "arraybuffer";
      socket = ws;
      lastMessageAt = Date.now();

      ws.onopen = () => {
        lastMessageAt = Date.now();
        update(() => ({ connection: "open" }));
      };
      ws.onmessage = (event: MessageEvent) => {
        lastMessageAt = Date.now();
        if (typeof event.data === "string") {
          const message = parseLiveText(event.data);
          if (!message) return;
          // 첫 relay_state를 받아야 연결이 제대로 선 것으로 본다.
          if (message.kind === "relay_state") {
            failures = 0;
            ticketRetried = false;
          }
          handleText(message);
        } else if (event.data instanceof ArrayBuffer) {
          handleFrame(event.data);
        }
      };
      ws.onclose = (event: CloseEvent) => {
        socket = null;
        switch (closeAction(event.code, event.reason)) {
          case "ended":
            stop({ connection: "ended", frame: null });
            // 작업 조회가 끝난 상태를 받으면 결과·증거 쿼리를 다시 받는다(useJob 참고).
            void client.invalidateQueries({ queryKey: reportKeys.job(jobId) });
            void client.invalidateQueries({ queryKey: reportKeys.report(reportId), exact: true });
            return;
          case "stop":
            return stop({ connection: "failed" });
          case "login":
            return login();
          case "hide":
            return stop({ hidden: true, frame: null });
          case "new-ticket":
            if (!ticketRetried) {
              ticketRetried = true;
              void connect();
              return;
            }
            return stop({ connection: "failed" });
          case "backoff":
            return schedule();
        }
      };
    };

    // 응답이 끊긴 연결(heartbeat 없음)은 닫고 다시 연결한다.
    const watchdog = setInterval(() => {
      if (socket && Date.now() - lastMessageAt > SILENCE_MS) schedule();
    }, 5_000);

    const onVisibility = () => {
      if (stopped) return;
      if (document.hidden) {
        closeSocket();
        update((prev) => ({ connection: "paused", frame: staleFrame(prev.frame) }));
      } else {
        failures = 0;
        void connect();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) void connect();
    else timer = setTimeout(() => update(() => ({ connection: "paused" })), 0);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(watchdog);
      closeSocket();
    };
  }, [client, reportId, jobId, generation]);

  // 최신 화면만 들고 있는다: 화면이 바뀌거나 사라지면 이전 Blob URL을 해제한다.
  const url = state.frame?.url;
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const retry = () => {
    setState((prev) => ({ ...INITIAL, frame: prev.frame }));
    setGeneration((value) => value + 1);
  };

  return { ...state, retry };
}
