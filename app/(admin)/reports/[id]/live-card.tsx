"use client";

import { useEffect, useState } from "react";
import { Card, button } from "@/components/ui";
import { conditionSummary, useTestConditions } from "@/lib/test-conditions";
import { STAGES, progressChips, stageOf, type Frame, type LiveState } from "./live-state";
import { useLivePreview } from "./use-live-preview";

type Tone = "live" | "warning" | "plain";

type View = {
  tag: { text: string; tone: Tone };
  stages: boolean;
  chips: boolean;
  notice?: { title: string; body: string; tone?: "warning"; retry?: boolean };
  /** 화면 칸. none이면 칸을 그리지 않는다. */
  screen: "none" | "frame" | "stale" | "empty";
  overlay?: { title: string; body?: string };
  caption?: string;
};

const CAPTION = "AI가 실제 브라우저에서 보는 화면이에요. 입력란과 민감한 영역은 가려져요. 화면은 보기만 할 수 있어요.";
const KEEPS_RUNNING = "미리보기 연결만 끊겼어요. 재현은 계속 진행되고, 끝나면 결과가 그대로 보여요.";

/** 연결·중계 상태를 화면 하나로 정한다. 위에서부터 먼저 맞는 것을 쓴다. */
function viewOf(state: LiveState): View {
  const hasFrame = state.frame != null;

  switch (state.stopped) {
    case "not_found":
    case "unauthenticated":
    case "rejected":
      return {
        tag: { text: "연결 안 됨", tone: "plain" },
        stages: false,
        chips: false,
        screen: "none",
        notice: {
          title: "실시간 화면을 볼 수 없어요",
          body:
            state.stopped === "unauthenticated"
              ? "로그인이 끝났어요. 다시 로그인한 뒤 새로고침하세요."
              : "이 신고에 접근 권한이 없거나 연결이 거부됐어요. 진행 상태는 아래 타임라인에서 볼 수 있어요.",
        },
      };
    case "gave_up":
      return {
        tag: { text: "연결 안 됨", tone: "plain" },
        stages: true,
        chips: false,
        screen: hasFrame ? "stale" : "none",
        notice: { title: "실시간 화면에 연결하지 못했어요", body: KEEPS_RUNNING, retry: true },
      };
    case "ended":
      return ended();
  }

  if (state.connection === "reconnecting") {
    return {
      tag: { text: "다시 연결하는 중…", tone: "warning" },
      stages: true,
      chips: true,
      screen: hasFrame ? "stale" : "empty",
      overlay: hasFrame ? undefined : { title: "다시 연결하는 중이에요" },
      notice: state.tooMany
        ? { title: "열린 실시간 화면이 너무 많아요", body: "다른 탭에서 연 실시간 화면을 닫으면 다시 연결돼요.", tone: "warning" }
        : undefined,
      caption: KEEPS_RUNNING,
    };
  }

  switch (state.preview) {
    case null:
    case "starting":
      return waitingFirst("연결 중");
    case "queued":
      return waitingFirst("재현 대기 중");
    case "ended":
      return ended();
    case "disabled":
      return {
        tag: { text: "미리보기 꺼짐", tone: "plain" },
        stages: false,
        chips: false,
        screen: "none",
        notice: {
          title: "이 재현 서버는 실시간 화면을 보내지 않아요",
          body: "진행 단계는 아래 실행 타임라인에서 볼 수 있어요. 끝나면 녹화 영상과 스크린샷으로 확인하세요.",
        },
      };
    case "cancelling":
      return {
        tag: { text: "취소하는 중", tone: "plain" },
        stages: false,
        chips: false,
        screen: "empty",
        overlay: { title: "재현을 취소하는 중이에요" },
      };
    case "worker_lost":
      return {
        tag: { text: "재현 서버 응답 없음", tone: "warning" },
        stages: false,
        chips: false,
        screen: "empty",
        overlay: { title: "재현 서버와 연결이 끊겼어요", body: "상태를 확인하는 중이에요. 잠시 뒤 실행 결과가 바뀔 수 있어요." },
      };
    case "relay_unavailable":
      return {
        tag: { text: "전송 장애", tone: "warning" },
        stages: true,
        chips: true,
        screen: hasFrame ? "stale" : "empty",
        overlay: hasFrame ? undefined : { title: "화면을 기다리고 있어요" },
        notice: {
          title: "화면 전송이 잠시 멈췄어요",
          body: "재현 실패가 아니에요. 재현은 계속 진행되고, 전송이 돌아오면 화면도 다시 나와요.",
          tone: "warning",
        },
      };
  }

  // live, waiting
  const live: Pick<View, "tag" | "stages" | "chips"> = { tag: { text: "실시간", tone: "live" }, stages: true, chips: true };
  if (state.engineEnded) return ended();
  if (state.progress?.phase === "login") {
    return {
      ...live,
      screen: "empty",
      overlay: { title: "로그인하는 동안은 화면을 보여 주지 않아요", body: "등록한 테스트 계정 정보를 보호하려고 가려요." },
    };
  }
  if (state.lastKind === "status" && stageOf(state) === 2) {
    return {
      ...live,
      screen: hasFrame ? "stale" : "empty",
      overlay: { title: "재현 계획을 세우는 중이에요", body: "이 동안 브라우저 화면은 바뀌지 않아요." },
    };
  }
  if (!hasFrame) {
    return {
      ...live,
      screen: "empty",
      overlay:
        state.preview === "waiting"
          ? { title: "재현을 준비하는 중이에요", body: "테스트 계정과 조건을 준비하고 있어요." }
          : { title: "첫 화면을 기다리고 있어요", body: "재현이 시작되면 AI가 보는 화면이 여기에 나와요." },
    };
  }
  return { ...live, screen: "frame", caption: CAPTION };
}

function waitingFirst(text: string): View {
  return {
    tag: { text, tone: "plain" },
    stages: true,
    chips: false,
    screen: "empty",
    overlay: { title: "첫 화면을 기다리고 있어요", body: "재현이 시작되면 AI가 보는 화면이 여기에 나와요." },
  };
}

function ended(): View {
  return {
    tag: { text: "재현 끝남", tone: "plain" },
    stages: false,
    chips: false,
    screen: "empty",
    overlay: { title: "재현이 끝났어요. 결과를 정리하는 중이에요", body: "준비되면 이 화면이 재현 결과로 바뀌어요." },
  };
}

/** 1초마다 다시 그려 "n초 전"을 갱신한다. */
function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enabled]);
  return now;
}

const clock = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

function ago(frame: Frame, now: number): string {
  const seconds = Math.max(0, Math.round((now - frame.receivedAt) / 1000));
  if (seconds < 60) return `${seconds}초 전 화면`;
  return `${Math.floor(seconds / 60)}분 전 화면`;
}

/**
 * 실행 중인 재현의 실시간 화면. 관찰 전용이다.
 * 연결 끊김·중계 장애는 재현 실패와 따로 보여 주고, 진행 상태 조회(타임라인)는 그대로 둔다.
 */
export function LiveCard({ jobId, programId }: { jobId: string; programId: string }) {
  const { state, retry } = useLivePreview(jobId);
  const view = viewOf(state);
  const now = useNow(view.tag.tone === "live" && state.frame != null);
  const stage = stageOf(state);
  const chips = view.chips ? progressChips(state.progress) : [];

  // 조건 비교 실행이면 지금 조건 이름을 붙인다.
  const conditions = useTestConditions(state.conditionId ? programId : undefined);
  const condition = conditions.data?.items.find((item) => item.condition_id === state.conditionId);
  const conditionText = state.conditionId
    ? `조건 ${condition ? `${condition.label} · ${conditionSummary(condition)}` : state.conditionId}`
    : undefined;

  return (
    <Card
      title="실시간 재현 화면"
      description={conditionText}
      aside={
        <div className="flex shrink-0 items-center gap-2">
          <LiveTag text={view.tag.text} tone={view.tag.tone} />
          {view.tag.tone === "live" && state.frame && (
            <span className="text-xs text-muted tabular-nums">{ago(state.frame, now)}</span>
          )}
        </div>
      }
    >
      {view.stages && <Stages current={stage} />}
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="지금 진행">
          {chips.map((chip) => (
            <li key={chip} className="rounded-md bg-surface-inset px-2 py-1 text-xs font-medium text-label">
              {chip}
            </li>
          ))}
        </ul>
      )}
      {view.notice && (
        <div
          className={`flex flex-col gap-1 rounded-lg px-4 py-3.5 ${view.notice.tone === "warning" ? "bg-warning-soft" : "bg-surface-inset"}`}
        >
          <p className={`text-sm font-semibold ${view.notice.tone === "warning" ? "text-warning-ink" : ""}`}>
            {view.notice.title}
          </p>
          <p className="text-[13px] text-subtle">{view.notice.body}</p>
          {view.notice.retry && (
            <button type="button" className={`${button.ghost} mt-2 self-start`} onClick={retry}>
              다시 연결
            </button>
          )}
        </div>
      )}
      {view.screen !== "none" && <Screen view={view} frame={state.frame} />}
      {view.caption && <p className="text-xs text-muted">{view.caption}</p>}
    </Card>
  );
}

function LiveTag({ text, tone }: { text: string; tone: Tone }) {
  const color = tone === "live" ? "text-primary-ink" : tone === "warning" ? "text-warning-ink" : "text-subtle";
  const dot = tone === "live" ? "bg-primary animate-pulse" : tone === "warning" ? "bg-warning" : null;
  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-md bg-surface-inset px-2 py-1 text-xs font-medium ${color}`}
    >
      {dot && <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />}
      {text}
    </span>
  );
}

function Stages({ current }: { current: number | null }) {
  return (
    <ol className="grid grid-cols-6 gap-1" aria-label="재현 단계">
      {STAGES.map((label, index) => {
        const state = current == null || index > current ? "todo" : index === current ? "current" : "done";
        return (
          <li key={label} className="flex min-w-0 flex-col gap-1.5">
            <span
              aria-hidden
              className={`h-1 rounded-full ${state === "current" ? "bg-primary" : state === "done" ? "bg-primary/45" : "bg-chip"}`}
            />
            <span
              className={`truncate text-xs ${
                state === "current" ? "font-semibold text-primary-ink" : state === "done" ? "text-label" : "text-muted"
              }`}
            >
              {label}
              {state === "current" && <span className="sr-only"> (지금 단계)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Screen({ view, frame }: { view: View; frame: Frame | null }) {
  const showImage = frame && (view.screen === "frame" || view.screen === "stale");
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-surface-inset"
      style={{ aspectRatio: frame ? `${frame.width} / ${frame.height}` : "16 / 10" }}
    >
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element -- 메모리의 Blob URL이라 이미지 최적화를 거칠 수 없다.
        <img
          src={frame.url}
          alt="AI가 보고 있는 재현 브라우저 화면"
          className={`absolute inset-0 size-full object-contain ${view.screen === "stale" ? "opacity-45" : ""}`}
        />
      )}
      {view.screen === "stale" && frame && !view.overlay && (
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
          <span aria-hidden className="size-1.5 rounded-full bg-warning" />
          마지막으로 받은 화면 · {clock.format(frame.receivedAt)}
        </span>
      )}
      {view.overlay && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="flex max-w-sm flex-col items-center gap-1.5 rounded-[10px] bg-black/70 px-5 py-3.5 text-center">
            <p className="text-[15px] font-semibold text-white">{view.overlay.title}</p>
            {view.overlay.body && <p className="text-[13px] text-white/70">{view.overlay.body}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
