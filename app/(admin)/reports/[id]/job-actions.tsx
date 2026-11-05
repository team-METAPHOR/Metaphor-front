"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { reportKeys } from "./queries";
import { ErrorText, buttonClass } from "./ui";

/** "다시 검증"(fresh). 확인을 한 번 더 받는다. reviewer, admin만 보인다. */
export function RevalidateButton({ reportId, disabled }: { reportId: string; disabled?: boolean }) {
  const { canReview } = useSession();
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const revalidate = useMutation({
    mutationFn: () =>
      api<Schemas["JobQueued"]>(`/reports/${encodeURIComponent(reportId)}/validation-jobs`, {
        method: "POST",
        body: { mode: "fresh" },
        idempotent: true,
      }),
    onSuccess: () => {
      setConfirming(false);
      // 신고의 latest_job이 새 job으로 바뀌면 화면이 그 job을 따라간다.
      return client.invalidateQueries({ queryKey: reportKeys.report(reportId) });
    },
  });

  if (!canReview) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-soft px-3 py-1.5 text-sm">
          <span>신고 내용으로 새 검증을 시작할까요?</span>
          <button
            type="button"
            className={buttonClass.primary}
            disabled={revalidate.isPending}
            onClick={() => revalidate.mutate()}
          >
            {revalidate.isPending ? "요청 중…" : "시작"}
          </button>
          <button
            type="button"
            className={buttonClass.secondary}
            disabled={revalidate.isPending}
            onClick={() => {
              setConfirming(false);
              revalidate.reset();
            }}
          >
            그만두기
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={buttonClass.secondary}
          disabled={disabled}
          title={disabled ? "검증이 진행 중이에요." : undefined}
          onClick={() => setConfirming(true)}
        >
          다시 검증
        </button>
      )}
      {revalidate.error instanceof ApiError && revalidate.error.code === "ORIGIN_NOT_VERIFIED" ? (
        <p role="alert" className="text-sm text-red-600">
          테스트 대상 도메인의 소유 확인이 필요해요.{" "}
          <Link href="/settings" className="font-medium underline">
            사이트 설정
          </Link>
          에서 확인하세요.
        </p>
      ) : (
        revalidate.error && <ErrorText error={revalidate.error} prefix="검증을 요청하지 못했어요." />
      )}
    </div>
  );
}

/** 진행 중인 job 취소. reviewer, admin만 보인다. */
export function CancelJobButton({ jobId, status }: { jobId: string; status: string }) {
  const { canReview } = useSession();
  const client = useQueryClient();
  const cancel = useMutation({
    mutationFn: () =>
      api<Schemas["JobCancelled"]>(`/validation-jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: reportKeys.job(jobId), exact: true }),
  });

  if (!canReview) return null;
  const cancelling = status === "cancelling";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={buttonClass.danger}
        disabled={cancel.isPending || cancelling}
        onClick={() => cancel.mutate()}
      >
        {cancelling ? "취소 중…" : cancel.isPending ? "요청 중…" : "취소"}
      </button>
      {cancel.error && <ErrorText error={cancel.error} prefix="취소하지 못했어요." />}
    </div>
  );
}
