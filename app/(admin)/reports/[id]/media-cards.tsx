"use client";

import { useState } from "react";
import { Card, button } from "@/components/ui";
import type { Schemas } from "@/lib/api";
import { evidenceUrl, useArtifacts, useEvidenceText } from "./queries";
import { CopyButton } from "./run-cards";
import { formatDuration } from "./run-history";
import { ErrorText, Inset } from "./ui";

type Video = Schemas["VideoMedia"];

/** 재생할 파일이 없는 영상의 이유. */
const VIDEO_MISSING: Record<string, string> = {
  failed: "녹화 파일을 만드는 중에 실패했어요.",
  unavailable: "재현 서버에 영상 인코더가 없어 녹화하지 못했어요.",
  empty: "녹화된 화면이 없어요.",
  interrupted: "녹화를 마무리하는 중에 실행이 취소됐어요.",
  // ready인데 파일이 없으면 보관 기간이 지난 것이다.
  ready: "보관 기간이 지나 영상이 지워졌어요.",
};

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Inset className="flex flex-col gap-1 py-4 pl-[18px]">
      <span className="text-[15px] font-semibold">{title}</span>
      <span className="text-[13px] text-subtle">{children}</span>
    </Inset>
  );
}

function attemptName(video: Video, index: number): string {
  return `시도 ${video.attempt ?? index + 1}`;
}

function AttemptTabs({ videos, picked, onPick }: { videos: Video[]; picked: number; onPick: (index: number) => void }) {
  return (
    <div className="flex shrink-0 gap-0.5 rounded-lg bg-code p-[3px]">
      {videos.map((video, index) => {
        const on = index === picked;
        return (
          <button
            key={index}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(index)}
            className={`rounded-md px-3 py-1 text-[13px] transition ${
              on ? "bg-chip font-medium text-foreground" : "text-muted hover:text-body"
            }`}
          >
            {attemptName(video, index)}
          </button>
        );
      })}
    </div>
  );
}

/** 시도별 마스킹 재현 영상. 실행 중이거나 결과가 지워졌으면(video_enabled null) 그리지 않는다. */
export function VideoCard({ jobId }: { jobId: string }) {
  const artifacts = useArtifacts(jobId);
  const [picked, setPicked] = useState(0);
  const media = artifacts.data?.media;
  if (!media || media.video_enabled == null) return null;

  if (!media.video_enabled) {
    return (
      <Card title="재현 영상">
        <Notice title="이 실행은 영상을 녹화하지 않았어요">
          재현 서버에서 영상 녹화가 꺼져 있어요. 재현 스크린샷으로 확인하세요.
        </Notice>
      </Card>
    );
  }

  const videos = media.videos;
  if (videos.length === 0) return null;
  const index = Math.min(picked, videos.length - 1);
  const video = videos[index];
  const name = attemptName(video, index);
  const playable = videos.some((item) => item.artifact_id);
  const facts = [
    name,
    formatDuration(video.duration_seconds),
    video.sampling_fps != null ? `초당 ${video.sampling_fps}장 녹화` : null,
  ].filter(Boolean);

  return (
    <Card
      title="재현 영상"
      aside={videos.length > 1 && <AttemptTabs videos={videos} picked={index} onPick={setPicked} />}
    >
      {video.artifact_id ? (
        <>
          {/* key로 시도를 바꿀 때 재생 위치를 처음으로 돌린다. */}
          <video
            key={video.artifact_id}
            src={evidenceUrl(video.artifact_id)}
            controls
            muted
            preload="metadata"
            className="aspect-video w-full rounded-lg bg-code"
          >
            {name} 재현 영상
          </video>
          <p className="flex flex-wrap gap-x-1.5 text-[13px] text-subtle">
            <span>{facts.join(" · ")}</span>
            {video.truncated ? (
              <span className="text-warning-ink">· 녹화 한도에 걸려 앞부분만 담겼어요</span>
            ) : (
              <span className="text-muted">· 입력값과 개인정보는 가려서 녹화했어요</span>
            )}
          </p>
        </>
      ) : (
        <Notice title={`${name} 영상을 볼 수 없어요`}>
          {VIDEO_MISSING[video.status] ?? "영상 파일이 없어요."}
          {playable && " 다른 시도 영상은 볼 수 있어요."}
        </Notice>
      )}
    </Card>
  );
}

const SPEC_NAME = "reproduction.spec.ts";

/** 재현된 실행에서 엔진이 내보낸 Playwright 테스트. 정상 동작을 검사하므로 고치기 전에는 실패한다. */
export function TestExportCard({ jobId }: { jobId: string }) {
  const artifacts = useArtifacts(jobId);
  const exported = artifacts.data?.media.test_export;
  const fileId = exported?.status === "ready" ? exported.artifact_id : null;
  const source = useEvidenceText(fileId);
  if (!exported) return null;

  if (!fileId) {
    return (
      <Card title="Playwright 재현 테스트" description="재현된 동작을 검사하는 Playwright 테스트예요.">
        <Notice title="테스트 파일을 만들지 못했어요">
          {exported.status === "ready"
            ? "보관 기간이 지나 테스트 파일이 지워졌어요. 다시 재현하면 새로 만들어요."
            : "재현 절차를 보고 직접 작성하거나, 다시 재현하면 새로 만들어요."}
          {exported.error_code && ` 오류 코드 ${exported.error_code}`}
        </Notice>
      </Card>
    );
  }

  const env = exported.required_environment;
  return (
    <Card
      title="Playwright 재현 테스트"
      description="재현된 동작을 검사해요. 지금은 실패하고, 고친 뒤 통과하면 해결된 거예요."
      aside={
        <div className="flex shrink-0 gap-2">
          {source.data != null && <CopyButton text={source.data} label="복사" />}
          <a href={evidenceUrl(fileId)} download={SPEC_NAME} className={button.ghost}>
            내려받기
          </a>
        </div>
      }
    >
      <div className="overflow-hidden rounded-lg bg-code">
        <div className="border-b border-line px-4 py-2.5 font-mono text-xs text-subtle">{SPEC_NAME}</div>
        {source.isError ? (
          <div className="p-4">
            <ErrorText error={source.error} prefix="테스트 파일을 불러오지 못했어요." />
          </div>
        ) : source.data == null ? (
          <div className="m-4 h-40 animate-pulse rounded-md bg-surface-inset" aria-busy="true" />
        ) : (
          <pre className="max-h-[480px] overflow-auto p-4 font-mono text-[13px] leading-[22px] text-label">
            {source.data}
          </pre>
        )}
        <div className="border-t border-line px-4 py-2.5 font-mono text-xs text-muted">
          $ npx playwright test {SPEC_NAME}
        </div>
      </div>
      {env.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-subtle">실행 전에 설정할 환경변수</span>
          {env.map((name) => (
            <code key={name} className="rounded-md bg-chip px-2 py-0.5 font-mono text-xs text-label">
              {name}
            </code>
          ))}
          <span className="text-muted">· 계정 비밀값은 테스트에 들어가지 않아요</span>
        </div>
      )}
    </Card>
  );
}
