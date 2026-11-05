"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  MAX_RETRIES,
  backoffMs,
  closeOutcome,
  decodeFrame,
  initialLiveState,
  liveReducer,
  parseText,
} from "./live-state";
import { reportKeys } from "./queries";

/** heartbeat(15초) 두 번을 놓치면 끊긴 연결로 보고 다시 붙는다. */
const SILENCE_MS = 40_000;

/** 클라이언트가 닫는 코드(3000~4999 중 서버가 쓰지 않는 값). 재접속 대상이다. */
const CLIENT_STALE = 4999;

/**
 * 실행 중인 job의 실시간 재현 화면. 같은 출처의 /api/v1로 붙고 Next.js가 API로 프록시한다.
 * 작업이 바뀌면 호출하는 쪽에서 key로 새로 마운트한다.
 */
export function useLivePreview(jobId: string) {
  const client = useQueryClient();
  const [state, dispatch] = useReducer(liveReducer, initialLiveState);
  // "다시 연결" 버튼이 올리면 effect가 새 소켓을 연다.
  const [generation, setGeneration] = useState(0);
  // reducer에 넘긴 Blob URL. 화면에 걸린 것 말고는 바로 해제한다.
  const urls = useRef(new Set<string>());

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let silenceTimer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;
    let disposed = false;

    // 엔진은 끝났고 서버가 결과를 정리했다. job을 다시 받으면 useJob이 결과·영상 쿼리를 새로 받는다.
    const refreshJob = () => void client.invalidateQueries({ queryKey: reportKeys.job(jobId) });

    const connect = () => {
      const scheme = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${scheme}://${location.host}/api/v1/validation-jobs/${encodeURIComponent(jobId)}/live`);
      ws.binaryType = "arraybuffer";
      socket = ws;

      const watch = () => {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => ws.close(CLIENT_STALE, "silent"), SILENCE_MS);
      };

      ws.onopen = () => {
        dispatch({ type: "open" });
        watch();
      };

      ws.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
        watch();
        retries = 0;
        if (typeof event.data === "string") {
          const message = parseText(event.data);
          if (message?.kind === "relay_state") {
            dispatch({ type: "relay", preview: message.preview, stream: message.stream, conditionId: message.conditionId });
            if (message.preview === "ended") refreshJob();
          } else if (message?.kind === "engine") {
            dispatch({ type: "engine", meta: message.meta });
          }
          return;
        }
        const decoded = decodeFrame(event.data);
        if (!decoded) return;
        const url = URL.createObjectURL(new Blob([decoded.jpeg], { type: "image/jpeg" }));
        // 다 그릴 수 있게 된 뒤에 바꿔 끼운다. 늦게 끝난 이전 화면은 reducer가 sequence로 버린다.
        const image = new Image();
        image.src = url;
        image.decode().then(
          () => {
            if (disposed) {
              URL.revokeObjectURL(url);
              return;
            }
            // dispatch 직전에 등록해야 디코딩 중인 URL을 정리 effect가 먼저 해제하지 않는다.
            urls.current.add(url);
            dispatch({
              type: "frame",
              stream: decoded.stream,
              frame: {
                url,
                sequence: decoded.sequence,
                width: decoded.width,
                height: decoded.height,
                receivedAt: Date.now(),
              },
            });
          },
          // 깨진 JPEG는 버리고 지금 화면을 유지한다.
          () => URL.revokeObjectURL(url),
        );
      };

      ws.onclose = (event) => {
        clearTimeout(silenceTimer);
        if (disposed || socket !== ws) return;
        const outcome = closeOutcome(event.code);
        if ("stop" in outcome) {
          dispatch({ type: "stop", reason: outcome.stop });
          if (outcome.stop === "ended") refreshJob();
          return;
        }
        if (retries >= MAX_RETRIES) {
          dispatch({ type: "stop", reason: "gave_up" });
          return;
        }
        dispatch({ type: "reconnecting", tooMany: outcome.tooMany });
        retryTimer = setTimeout(connect, backoffMs(retries, outcome.tooMany));
        retries += 1;
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      clearTimeout(silenceTimer);
      socket?.close(1000);
    };
  }, [client, jobId, generation]);

  // 화면에 걸린 URL 말고는 모두 해제한다(교체·거절·비우기). 언마운트 때는 전부.
  const shown = state.frame?.url;
  useEffect(() => {
    for (const url of urls.current) {
      if (url !== shown) {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }
    }
  });
  useEffect(() => {
    const created = urls.current;
    return () => {
      for (const url of created) URL.revokeObjectURL(url);
      created.clear();
    };
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: "retry" });
    setGeneration((value) => value + 1);
  }, []);

  return { state, retry };
}
