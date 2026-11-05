"use client";

import { useEffect, useRef } from "react";
import { ApiError } from "@/lib/api";
import { errorMessage } from "../settings/ui";

export const orgKeys = {
  detail: (orgId: string) => ["orgs", orgId] as const,
  members: (orgId: string) => ["orgs", orgId, "members"] as const,
  invites: (orgId: string) => ["orgs", orgId, "invites"] as const,
};

export const roles = ["developer", "reviewer", "admin"] as const;

export const buttonClass =
  "shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60";
export const secondaryButtonClass =
  "shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-background disabled:opacity-60";
export const dangerButtonClass =
  "shrink-0 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-60";
export const inputClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ko-KR");
}

/** 조직·멤버·초대 API의 에러 코드를 한국어 안내로 바꾼다. */
export function orgErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "LAST_ADMIN":
        return "조직에는 활성 관리자가 한 명 이상 있어야 해요. 다른 멤버를 먼저 관리자로 지정하세요.";
      case "INVITE_LIMIT":
        return "대기 중인 초대가 너무 많아요(최대 50개). 쓰지 않는 초대를 취소한 뒤 다시 시도하세요.";
      case "FORBIDDEN":
        return "관리자만 할 수 있어요.";
      case "NOT_FOUND":
        return "대상을 찾을 수 없어요. 이미 처리됐을 수 있으니 새로고침하세요.";
      case "CSRF_REJECTED":
        return "허용되지 않은 출처에서 보낸 요청이에요.";
    }
    if (error.status === 422) return "입력값을 확인하세요.";
    if (error.status === 429) return "요청이 너무 많아요. 잠시 후 다시 시도하세요.";
  }
  return errorMessage(error);
}

/** 확인 대화상자. open이 바뀌면 열고 닫는다. Esc나 취소로 닫으면 onClose를 부른다. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  isPending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="confirm-title"
      onClose={onClose}
      className="m-auto w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl backdrop:bg-black/40"
    >
      <h3 id="confirm-title" className="text-base font-semibold">
        {title}
      </h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
      {error != null && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {orgErrorMessage(error)}
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
          disabled={isPending}
          onClick={onConfirm}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
