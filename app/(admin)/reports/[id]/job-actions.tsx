"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      {revalidate.error && <JobRequestError error={revalidate.error} prefix="검증을 요청하지 못했어요." />}
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

/** 재시험 기준이 될 수 있는 판정. 서버도 같은 조건으로 막는다. */
const COMPARABLE_VERDICTS = ["reproduced", "not_reproduced"];

/**
 * "재시험"(retest). 최신 job을 기준으로 같은 재현 계획을 승인된 테스트 빌드에 다시 돌린다.
 * 버그가 고쳐졌는지 확인하는 용도. reviewer, admin만 보인다.
 */
export function RetestButton({
  reportId,
  programId,
  baseline,
}: {
  reportId: string;
  programId: string;
  baseline: Schemas["JobOut"] | undefined;
}) {
  const { canReview } = useSession();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const program = useQuery({
    queryKey: ["programs", programId],
    queryFn: () => api<Schemas["ProgramResponse"]>(`/programs/${encodeURIComponent(programId)}`),
    enabled: open,
  });
  const retest = useMutation({
    mutationFn: (appVersion: string) =>
      api<Schemas["JobQueued"]>(`/reports/${encodeURIComponent(reportId)}/validation-jobs`, {
        method: "POST",
        body: { mode: "retest", baseline_job_id: baseline?.id, app_version: appVersion },
        idempotent: true,
      }),
    onSuccess: () => {
      setOpen(false);
      return client.invalidateQueries({ queryKey: reportKeys.report(reportId) });
    },
  });

  if (!canReview) return null;

  const comparable =
    baseline?.status === "completed" && baseline.verdict != null && COMPARABLE_VERDICTS.includes(baseline.verdict);
  const versions = program.data?.scope.approved_app_versions ?? [];
  const selected = versions.includes(version) ? version : (versions[0] ?? "");

  function close() {
    setOpen(false);
    retest.reset();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {open ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-soft px-3 py-1.5 text-sm">
          {program.isPending ? (
            <span>테스트 버전을 불러오는 중…</span>
          ) : program.isError ? (
            <span className="text-red-600">사이트 정보를 불러오지 못했어요.</span>
          ) : versions.length === 0 ? (
            <span>
              승인된 테스트 버전이 없어요.{" "}
              <Link href={`/settings?program=${encodeURIComponent(programId)}`} className="font-medium underline">
                사이트 설정
              </Link>
              에서 추가하세요.
            </span>
          ) : (
            <>
              <label htmlFor="retest-version">테스트 버전</label>
              <select
                id="retest-version"
                value={selected}
                onChange={(event) => setVersion(event.target.value)}
                className="rounded-lg border border-border bg-surface px-2 py-1 font-mono text-xs"
              >
                {versions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={buttonClass.primary}
                disabled={retest.isPending || selected === ""}
                onClick={() => retest.mutate(selected)}
              >
                {retest.isPending ? "요청 중…" : "시작"}
              </button>
            </>
          )}
          <button type="button" className={buttonClass.secondary} disabled={retest.isPending} onClick={close}>
            그만두기
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={buttonClass.secondary}
          disabled={!comparable}
          title={
            comparable
              ? "같은 재현 계획을 테스트 빌드에 다시 실행해 수정 여부를 확인해요."
              : "재현 여부가 확정된(재현됨/재현 안 됨) 검증이 끝나야 재시험할 수 있어요."
          }
          onClick={() => setOpen(true)}
        >
          재시험
        </button>
      )}
      {retest.error && <JobRequestError error={retest.error} prefix="재시험을 요청하지 못했어요." />}
    </div>
  );
}

/** 검증 요청(fresh/retest) 실패 안내. 사용자가 할 일이 있는 코드는 풀어서 알려준다. */
function JobRequestError({ error, prefix }: { error: unknown; prefix: string }) {
  const code = error instanceof ApiError ? error.code : null;
  if (code === "ORIGIN_NOT_VERIFIED") {
    return (
      <p role="alert" className="text-sm text-red-600">
        테스트 대상 도메인의 소유 확인이 필요해요.{" "}
        <Link href="/settings" className="font-medium underline">
          사이트 설정
        </Link>
        에서 확인하세요.
      </p>
    );
  }
  const message = code ? jobRequestMessages[code] : undefined;
  if (message) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {message}
      </p>
    );
  }
  return <ErrorText error={error} prefix={prefix} />;
}

const jobRequestMessages: Record<string, string> = {
  ACTIVE_JOB_EXISTS: "이미 진행 중인 검증이 있어요. 끝난 뒤 다시 시도하세요.",
  DAILY_LIMIT_EXCEEDED: "이 사이트의 오늘 검증 실행 한도를 다 썼어요.",
  PROGRAM_NOT_ACTIVE: "사이트가 운영 중이 아니거나 외부 AI 사용이 꺼져 있어 검증할 수 없어요.",
  REPORT_EXPIRED: "보관 기간이 지난 신고라 다시 검증할 수 없어요.",
  BASELINE_NOT_COMPARABLE: "재현 여부가 확정된 검증만 재시험 기준이 될 수 있어요.",
  SCOPE_CHANGED_USE_FRESH: "사이트 테스트 범위가 바뀌어 같은 조건으로 비교할 수 없어요. 다시 검증을 사용하세요.",
  APP_VERSION_NOT_APPROVED: "승인된 테스트 버전이 아니에요. 사이트 설정을 확인하세요.",
};
