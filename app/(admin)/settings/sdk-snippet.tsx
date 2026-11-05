"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { api, type Schemas } from "@/lib/api";
import { Card, CopyButton, errorMessage, widgetSettingsKey } from "./ui";

type WidgetSettings = Schemas["WidgetSettingsResponse"];
type ProjectKey = Schemas["ProjectKeyResponse"];

type Install = { projectKey: string; apiBase: string; sdkUrl: string; integrity: string };

/** 설치 코드 재료. 서버가 하나라도 주지 않으면(null) 코드를 만들지 않는다. */
function installInfo(settings: WidgetSettings): Install | null {
  const { public_project_key: projectKey, api_base: apiBase, sdk_url: sdkUrl, sdk_integrity: integrity } = settings;
  if (!projectKey || !apiBase || !sdkUrl || !integrity || !URL.canParse(apiBase)) return null;
  return { projectKey, apiBase, sdkUrl, integrity };
}

// crossorigin이 없으면 브라우저가 integrity를 검사하지 못해 스크립트를 막는다.
function snippet({ projectKey, apiBase, sdkUrl, integrity }: Install): string {
  return `<script src="${sdkUrl}"
        integrity="${integrity}"
        crossorigin="anonymous"
        data-metaphor-project-key="${projectKey}"
        data-metaphor-api-base="${apiBase}" defer></script>`;
}

/** SDK 번들과 위젯 API가 같은 origin에서 나온다. data:는 화면 캡처용. */
function csp(apiBase: string): string {
  const origin = new URL(apiBase).origin;
  return `Content-Security-Policy: script-src 'self' ${origin};
                         connect-src 'self' ${origin};
                         img-src 'self' data:`;
}

const codeBlock =
  "overflow-x-auto rounded-lg border border-border bg-code p-4 font-mono text-xs leading-5 text-body";

export function SdkSnippet({
  programId,
  settings,
  isAdmin,
}: {
  programId: string;
  settings: WidgetSettings;
  isAdmin: boolean;
}) {
  const key = settings.public_project_key;
  const install = installInfo(settings);
  return (
    <Card
      title="SDK 설치"
      description="고객사 사이트의 <head>에 아래 코드를 넣으세요."
      action={install ? <CopyButton text={snippet(install)} label="코드 복사" /> : undefined}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Project key</span>
        {key ? (
          <code className="rounded bg-background px-2 py-0.5 font-mono text-xs">{key}</code>
        ) : (
          <span className="rounded bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-ink">
            키 없음, 재발급 필요
          </span>
        )}
      </div>

      {install ? (
        <>
          <pre className={codeBlock}>{snippet(install)}</pre>
          <p className="mt-2 text-xs text-muted">
            SDK 버전이 오르면 설치 코드도 바뀌어요. 이전 코드는 동작을 멈추니 새 코드로 바꿔 넣으세요.
          </p>

          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-sm font-medium">CSP를 쓰는 사이트라면</p>
            <CopyButton text={csp(install.apiBase)} label="CSP 복사" />
          </div>
          <pre className={`mt-2 ${codeBlock}`}>{csp(install.apiBase)}</pre>
          <p className="mt-2 text-xs text-muted">
            script-src는 SDK 로드, connect-src는 신고 전송에 필요해요. img-src에 data:가 없으면 화면 사진 없이 글로만
            신고돼요.
          </p>
        </>
      ) : key ? (
        <p className="text-sm text-muted">설치 코드를 준비 중이에요. 잠시 후 다시 확인하세요.</p>
      ) : (
        <p className="text-sm text-muted">
          project key가 없어서 설치 코드를 만들 수 없어요. {isAdmin ? "아래에서 키를 재발급하세요." : "관리자에게 키 재발급을 요청하세요."}
        </p>
      )}

      <RotateKey programId={programId} isAdmin={isAdmin} hasKey={key !== null} />
    </Card>
  );
}

function RotateKey({ programId, isAdmin, hasKey }: { programId: string; isAdmin: boolean; hasKey: boolean }) {
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const rotate = useMutation({
    mutationFn: () =>
      api<ProjectKey>(`/programs/${encodeURIComponent(programId)}/widget-settings/rotate-key`, { method: "POST" }),
    onSuccess: ({ public_project_key }) => {
      queryClient.setQueryData<WidgetSettings>(widgetSettingsKey(programId), (old) =>
        old ? { ...old, public_project_key } : old,
      );
      dialog.current?.close();
    },
  });

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">키 재발급</p>
          <p className="text-xs text-muted">{isAdmin ? "새 키를 만들면 기존 키는 바로 무효가 돼요." : "관리자만 재발급할 수 있어요."}</p>
        </div>
        <button
          type="button"
          disabled={!isAdmin}
          onClick={() => {
            rotate.reset();
            dialog.current?.showModal();
          }}
          className="shrink-0 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:border-border disabled:text-muted disabled:hover:bg-transparent"
        >
          키 재발급
        </button>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="rotate-title"
        className="m-auto w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl backdrop:bg-black/40"
      >
        <h3 id="rotate-title" className="text-base font-semibold">
          project key를 재발급할까요?
        </h3>
        <p className="mt-2 text-sm text-muted">
          {hasKey
            ? "기존 키로 설치한 코드는 바로 동작을 멈춰요. 재발급 후 고객사 사이트의 설치 코드를 새 키로 바꿔야 해요."
            : "새 키를 발급해요. 발급 후 고객사 사이트에 설치 코드를 넣으세요."}
        </p>
        {rotate.isError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            재발급하지 못했어요. {errorMessage(rotate.error)}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background"
          >
            취소
          </button>
          <button
            type="button"
            disabled={rotate.isPending}
            onClick={() => rotate.mutate()}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {rotate.isPending ? "재발급 중…" : "재발급"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
