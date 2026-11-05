"use client";

import { Card, button } from "@/components/ui";
import * as labels from "@/lib/labels";
import type { LiveProgress } from "./live-frame";
import { actionLabel } from "./run-cards";
import { Inset, Labeled, Muted, formatDateTime } from "./ui";
import { useLivePreview, type LivePreviewState } from "./use-live-preview";

// 엔진 progress.phase → 화면 문구. 엔진이 보내는 enum만 옮기고 그 밖의 값은 보이지 않는다.
const PHASE_TEXT: Record<string, string> = {
  attempt_started: "시도 시작",
  login: "로그인 중(화면 비공개)",
  discovery: "화면 관찰",
  action: "동작 실행",
  action_completed: "동작 완료",
  readiness: "화면 준비 확인",
  outcome: "결과 확인",
  completed: "단계 완료",
  attempt_finished: "시도 종료",
  attempt_failed: "시도 실패",
};

type Tone = "live" | "plain" | "warning";

/** 연결·중계 상태를 한 줄로. */
function connectionText(state: LivePreviewState): { text: string; tone: Tone } {
  switch (state.connection) {
    case "connecting":
      return { text: "연결 중", tone: "plain" };
    case "reconnecting":
      return { text: "일시 끊김·재연결 중", tone: "warning" };
    case "paused":
      return { text: "일시 정지(탭이 숨겨짐)", tone: "plain" };
    case "ended":
      return { text: "종료", tone: "plain" };
    case "failed":
      return { text: "연결할 수 없음", tone: "warning" };
  }
  switch (state.preview) {
    case "live":
      return { text: "실시간", tone: "live" };
    case "disabled":
      return { text: "미리보기 꺼짐", tone: "plain" };
    case "queued":
    case "starting":
      return { text: "작업 대기", tone: "plain" };
    case "waiting":
      return { text: "화면 준비 중", tone: "plain" };
    case "relay_unavailable":
      return { text: "전송 장애", tone: "warning" };
    case "worker_lost":
      return { text: "워커 응답 없음", tone: "warning" };
    case "cancelling":
      return { text: "취소 중", tone: "plain" };
    case "ended":
      return { text: "종료", tone: "plain" };
    default:
      return { text: "연결 중", tone: "plain" };
  }
}

/** 화면이 없을 때 안내. */
function emptyText(state: LivePreviewState): string {
  if (state.preview === "disabled") return "이 작업 환경에서는 실시간 화면이 꺼져 있어요. 진행 단계와 결과는 그대로 볼 수 있어요.";
  if (state.engineEnded || state.preview === "ended") return "재현이 끝났어요. 결과를 정리하는 중이에요.";
  if (state.preview === "worker_lost") return "실행하던 워커가 응답하지 않아요. 작업 상태는 아래에서 계속 확인할 수 있어요.";
  if (state.preview === "cancelling") return "작업을 취소하는 중이에요.";
  if (state.progress?.phase === "login") return "로그인 화면은 보안을 위해 보여 주지 않아요.";
  if (state.preview === "queued" || state.preview === "starting") return "작업이 시작되면 화면이 나타나요.";
  if (state.connection === "failed") return "실시간 화면에 연결하지 못했어요. 재현은 계속 진행되고 결과는 그대로 볼 수 있어요.";
  return "첫 화면을 기다리는 중이에요.";
}

function attemptText(progress: LiveProgress): string | null {
  if (progress.attempt == null) return null;
  return progress.attempt === 0 ? "최초 화면 관찰" : `재현 시도 ${progress.attempt}/2`;
}

function stepText(progress: LiveProgress): string | null {
  if (progress.step_index == null) return null;
  const total = progress.total_steps != null && progress.total_steps > 0 ? ` / ${progress.total_steps}` : "";
  const action = progress.action ? actionLabel[progress.action] : undefined;
  return `${progress.step_index + 1}${total}단계${action ? ` · ${action}` : ""}`;
}

/** 실행 중인 작업의 실시간 재현 화면. 관찰 전용이며 클릭·입력은 보내지 않는다. */
export function LivePreviewCard({ reportId, jobId }: { reportId: string; jobId: string }) {
  const state = useLivePreview(reportId, jobId);
  if (state.hidden) return null;

  const status = connectionText(state);
  const progress = state.progress;
  const attempt = progress && attemptText(progress);
  const step = progress && stepText(progress);
  const phase = progress?.phase ? PHASE_TEXT[progress.phase] : undefined;
  const stage = state.stage ? labels.jobStage(state.stage) : null;
  const frame = state.frame;

  return (
    <Card
      title="실시간 재현 화면"
      description="AI가 실제 브라우저에서 재현하는 화면이에요. 입력란과 민감한 영역은 엔진이 가린 뒤 보내요."
      aside={
        <span
          role="status"
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${
            status.tone === "live"
              ? "bg-primary-soft text-primary-ink"
              : status.tone === "warning"
                ? "bg-warning-soft text-warning-ink"
                : "bg-chip text-label"
          }`}
        >
          {status.tone === "live" && <span aria-hidden className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-primary align-middle" />}
          {status.text}
        </span>
      }
    >
      <div className="overflow-hidden rounded-lg bg-code">
        {frame ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- 메모리의 Blob URL이라 최적화 프록시를 쓸 수 없다. */}
            <img
              src={frame.url}
              width={frame.width}
              height={frame.height}
              alt="실시간 재현 화면(마스킹됨)"
              className={`mx-auto h-auto max-h-[560px] w-auto max-w-full ${frame.stale ? "opacity-60" : ""}`}
            />
            {frame.stale && (
              <span className="absolute top-3 left-3 rounded-md bg-surface px-2 py-1 text-xs font-medium text-label">
                마지막 수신 화면
              </span>
            )}
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center p-6 text-center">
            <Muted>{emptyText(state)}</Muted>
          </div>
        )}
      </div>

      <Inset className="grid gap-4 sm:grid-cols-4">
        <Labeled label="작업 단계">
          <span className="text-sm font-medium">{stage?.label ?? "-"}</span>
        </Labeled>
        <Labeled label="시도">
          <span className="text-sm font-medium">{attempt ?? "-"}</span>
        </Labeled>
        <Labeled label="진행">
          <span className="text-sm font-medium">{[step, phase].filter(Boolean).join(" · ") || "-"}</span>
        </Labeled>
        <Labeled label="마지막 화면">
          <span className="text-sm font-medium tabular-nums">{frame ? formatDateTime(frame.createdAt) : "-"}</span>
        </Labeled>
      </Inset>

      {state.warning && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-ink">
          일부 화면을 보내지 못했어요. 재현과 판정에는 영향이 없어요.
        </p>
      )}
      {state.connection === "failed" && (
        <button type="button" className={`${button.ghost} self-start`} onClick={state.retry}>
          다시 연결
        </button>
      )}
    </Card>
  );
}
