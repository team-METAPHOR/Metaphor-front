"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";

export const widgetSettingsKey = (programId: string) => ["programs", programId, "widget-settings"] as const;

export function Card({
  title,
  description,
  action,
  children,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "권한이 없어요.";
    if (error.status === 404) return "찾을 수 없어요.";
    return error.requestId ? `${error.message} (요청 ID: ${error.requestId})` : error.message;
  }
  return error instanceof Error ? error.message : "알 수 없는 오류";
}

export function ErrorText({ error, what }: { error: unknown; what: string }) {
  return (
    <p role="alert" className="text-sm text-red-600">
      {what}을(를) 불러오지 못했어요. {errorMessage(error)}
    </p>
  );
}

export function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => setState("copied"),
          () => setState("failed"),
        );
        setTimeout(() => setState("idle"), 2000);
      }}
      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-background"
    >
      {state === "copied" ? "복사됨" : state === "failed" ? "복사 실패" : label}
    </button>
  );
}
