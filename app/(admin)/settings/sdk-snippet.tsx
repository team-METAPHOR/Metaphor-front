"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { api, type Schemas } from "@/lib/api";
import { Card, CopyButton, errorMessage, widgetSettingsKey } from "./ui";

type WidgetSettings = Schemas["WidgetSettingsResponse"];
type ProjectKey = Schemas["ProjectKeyResponse"];

// Metaphor-sdk README의 설치 방법. 배포 주소가 아직 정해지지 않아 자리표시자로 둔다.
const SDK_SRC = "https://<SDK 배포 주소>/sdk/metaphor.js";
const API_BASE = "https://<Metaphor API 주소>";

function snippet(projectKey: string): string {
  return `<script src="${SDK_SRC}"
        data-metaphor-project-key="${projectKey}"
        data-metaphor-api-base="${API_BASE}" defer></script>`;
}

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
  return (
    <Card
      title="SDK 설치"
      description="고객사 사이트의 <head>에 아래 코드를 넣으세요."
      action={key ? <CopyButton text={snippet(key)} label="코드 복사" /> : undefined}
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

      {key ? (
        <>
          <pre className="overflow-x-auto rounded-lg bg-sidebar p-4 font-mono text-xs leading-5 text-sidebar-foreground">
            {snippet(key)}
          </pre>
          <p className="mt-2 text-xs text-muted">
            <code>&lt;SDK 배포 주소&gt;</code>, <code>&lt;Metaphor API 주소&gt;</code>는 실제 배포 주소로 바꿔 넣으세요. CSP를
            쓰면 script-src에 SDK 주소, connect-src에 API 주소, img-src에 data:가 필요해요.
          </p>
        </>
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
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {rotate.isPending ? "재발급 중…" : "재발급"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
