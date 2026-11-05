"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { button } from "@/components/ui";
import { ApiError, api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { settingsLink } from "../../settings-modal/links";
import { reportKeys } from "./queries";
import { ErrorText } from "./ui";

/** 새 검증(fresh). 확인을 한 번 더 받는다. reviewer, admin만 보인다. */
export function RevalidateButton({
  reportId,
  label,
  primary,
  disabled,
}: {
  reportId: string;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}) {
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
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
          <span>신고 내용으로 처음부터 다시 재현할까요?</span>
          <button
            type="button"
            className={button.primary}
            disabled={revalidate.isPending}
            onClick={() => revalidate.mutate()}
          >
            {revalidate.isPending ? "요청 중…" : "시작"}
          </button>
          <button
            type="button"
            className={button.ghost}
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
          className={primary ? button.primary : button.secondary}
          disabled={disabled}
          title={disabled ? "재현이 진행 중이에요." : undefined}
          onClick={() => setConfirming(true)}
        >
          {label}
        </button>
      )}
      {revalidate.error && <JobRequestError error={revalidate.error} prefix="재현을 요청하지 못했어요." />}
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
        className={`${button.ghost} text-danger`}
        disabled={cancel.isPending || cancelling}
        onClick={() => cancel.mutate()}
      >
        {cancelling ? "취소 중…" : cancel.isPending ? "요청 중…" : "재현 취소"}
      </button>
      {cancel.error && <ErrorText error={cancel.error} prefix="취소하지 못했어요." />}
    </div>
  );
}

/** 검증 요청(fresh/retest) 실패 안내. 사용자가 할 일이 있는 코드는 풀어서 알려준다. */
export function JobRequestError({ error, prefix }: { error: unknown; prefix: string }) {
  const code = error instanceof ApiError ? error.code : null;
  if (code === "ORIGIN_NOT_VERIFIED") {
    return (
      <p role="alert" className="text-sm text-danger">
        테스트 대상 도메인의 소유 확인이 필요해요.{" "}
        <Link href={settingsLink("site")} className="font-medium underline">
          사이트 설정
        </Link>
        에서 확인하세요.
      </p>
    );
  }
  const message = code ? jobRequestMessages[code] : undefined;
  if (message) {
    return (
      <p role="alert" className="text-sm text-danger">
        {message}
      </p>
    );
  }
  return <ErrorText error={error} prefix={prefix} />;
}

const jobRequestMessages: Record<string, string> = {
  ACTIVE_JOB_EXISTS: "이미 진행 중인 재현이 있어요. 끝난 뒤 다시 시도하세요.",
  DAILY_LIMIT_EXCEEDED: "이 사이트의 오늘 실행 한도를 다 썼어요.",
  PROGRAM_NOT_ACTIVE: "사이트가 운영 중이 아니거나 외부 AI 사용이 꺼져 있어 실행할 수 없어요.",
  REPORT_EXPIRED: "보관 기간이 지난 신고라 다시 실행할 수 없어요.",
  BASELINE_NOT_COMPARABLE: "재현 여부가 확정된 실행만 수정 확인 기준이 될 수 있어요.",
  SCOPE_CHANGED_USE_FRESH: "사이트 테스트 범위가 바뀌어 같은 조건으로 비교할 수 없어요. 처음부터 다시 재현하세요.",
  APP_VERSION_NOT_APPROVED: "승인된 테스트 버전이 아니에요. 사이트 설정을 확인하세요.",
};
