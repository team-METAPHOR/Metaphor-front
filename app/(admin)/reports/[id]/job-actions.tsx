"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { button } from "@/components/ui";
import { ApiError, api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { AUTO_SELECT_DEFAULT, MAX_CONDITIONS_PER_RUN, conditionSummary, useTestConditions } from "@/lib/test-conditions";
import { settingsLink } from "../../settings-modal/links";
import { reportKeys } from "./queries";
import { ErrorText } from "./ui";

type FreshRequest = Partial<Pick<Schemas["JobRequest"], "condition_ids" | "auto_select_conditions" | "max_conditions">>;

/**
 * 새 검증(fresh). 확인을 한 번 더 받는다. developer, admin만 보인다.
 * 사이트에 테스트 조건이 있으면 기본 환경으로 돌릴지, 조건을 골라 비교할지 고른다.
 */
export function RevalidateButton({
  reportId,
  programId,
  label,
  primary,
  disabled,
}: {
  reportId: string;
  programId: string;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const { canReview } = useSession();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const revalidate = useMutation({
    mutationFn: (conditions: FreshRequest) =>
      api<Schemas["JobQueued"]>(`/reports/${encodeURIComponent(reportId)}/validation-jobs`, {
        method: "POST",
        body: { mode: "fresh", ...conditions },
        idempotent: true,
      }),
    onSuccess: () => {
      setOpen(false);
      // 신고의 latest_job이 새 job으로 바뀌면 화면이 그 job을 따라간다.
      return client.invalidateQueries({ queryKey: reportKeys.report(reportId) });
    },
  });

  if (!canReview) return null;

  function close() {
    setOpen(false);
    revalidate.reset();
  }

  return (
    <div className="relative flex flex-col items-end gap-1">
      <button
        type="button"
        className={primary ? button.primary : button.secondary}
        disabled={disabled || open}
        aria-expanded={open}
        title={disabled ? "재현이 진행 중이에요." : undefined}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <RevalidatePanel
          programId={programId}
          pending={revalidate.isPending}
          onStart={(conditions) => revalidate.mutate(conditions)}
          onCancel={close}
        />
      )}
      {revalidate.error && <JobRequestError error={revalidate.error} prefix="재현을 요청하지 못했어요." />}
    </div>
  );
}

/** 다시 재현 확인 창. 조건이 없으면 확인만 받는다. */
function RevalidatePanel({
  programId,
  pending,
  onStart,
  onCancel,
}: {
  programId: string;
  pending: boolean;
  onStart: (conditions: FreshRequest) => void;
  onCancel: () => void;
}) {
  const conditions = useTestConditions(programId);
  const items = conditions.data?.items ?? [];
  const [compare, setCompare] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [auto, setAuto] = useState(false);

  const full = picked.length >= MAX_CONDITIONS_PER_RUN;
  // AI 선택은 고른 조건을 후보로 쓰고, 하나도 안 고르면 등록한 조건 전부가 후보다.
  const ready = !compare || auto || picked.length > 0;
  const startLabel = !compare ? "시작" : auto ? "AI가 골라 재현" : `조건 ${picked.length}개로 재현`;

  function toggle(id: string) {
    setPicked((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]));
  }

  function start() {
    if (!compare) return onStart({});
    // 등록 순서대로 실행한다.
    const ids = items.map((item) => item.condition_id).filter((id) => picked.includes(id));
    onStart(
      auto
        ? { auto_select_conditions: true, max_conditions: AUTO_SELECT_DEFAULT, condition_ids: ids.length > 0 ? ids : null }
        : { condition_ids: ids },
    );
  }

  return (
    <div
      role="dialog"
      aria-label="다시 재현"
      className="absolute top-full right-0 z-20 mt-2 flex w-[380px] max-w-[calc(100vw-32px)] flex-col gap-3.5 rounded-xl border border-edge bg-surface p-4 shadow-lg"
    >
      <span className="text-[15px] font-semibold">신고 내용으로 처음부터 다시 재현할까요?</span>
      {items.length > 0 && (
        <div className="flex flex-col gap-3">
          <Choice checked={!compare} onSelect={() => setCompare(false)} title="기본 환경" help="사이트 기본 설정으로 한 번 실행해요." />
          <Choice
            checked={compare}
            onSelect={() => setCompare(true)}
            title="테스트 조건 비교"
            help={`고른 조건마다 따로 실행해요. 최대 ${MAX_CONDITIONS_PER_RUN}개까지 골라요.`}
          />
          {compare && (
            <>
              <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-lg bg-background px-2 py-1.5">
                {items.map((item) => {
                  const on = picked.includes(item.condition_id);
                  return (
                    <li key={item.condition_id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-chip/60">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!on && full}
                          onChange={() => toggle(item.condition_id)}
                          className="size-4 shrink-0 accent-primary"
                        />
                        <span className={`shrink-0 text-[13px] font-medium ${on ? "" : "text-label"}`}>{item.label}</span>
                        <span className="min-w-0 truncate text-xs text-muted">{conditionSummary(item)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={(event) => setAuto(event.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-label">AI가 고르기</span>
                  <span className="text-xs text-muted">
                    신고 내용을 보고 {picked.length > 0 ? "고른 조건" : "등록한 조건"} 중 최대 {AUTO_SELECT_DEFAULT}개를 골라
                    실행해요.
                  </span>
                </span>
              </label>
            </>
          )}
        </div>
      )}
      {conditions.isSuccess && items.length === 0 && (
        <p className="text-xs text-muted">
          계정·브라우저·화면 크기를 바꿔 비교하려면{" "}
          <Link href={settingsLink("repro", programId)} className="font-medium text-label underline">
            테스트 조건
          </Link>
          을 등록하세요.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={button.ghost} disabled={pending} onClick={onCancel}>
          그만두기
        </button>
        <button type="button" className={button.primary} disabled={pending || !ready} onClick={start}>
          {pending ? "요청 중…" : startLabel}
        </button>
      </div>
    </div>
  );
}

function Choice({ checked, onSelect, title, help }: { checked: boolean; onSelect: () => void; title: string; help: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="radio" checked={checked} onChange={onSelect} className="mt-0.5 size-4 shrink-0 accent-primary" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted">{help}</span>
      </span>
    </label>
  );
}

/** 진행 중인 job 취소. developer, admin만 보인다. */
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
  CONDITION_UNKNOWN: "등록되지 않은 테스트 조건이 있어요. 조건 목록을 새로 고친 뒤 다시 고르세요.",
  NO_TEST_CONDITIONS: "등록한 테스트 조건이 없어요. 사이트 설정에서 조건을 먼저 등록하세요.",
  CONDITION_RESUME_UNSUPPORTED: "조건 비교 실행은 이어서 재현할 수 없어요. 처음부터 다시 재현하세요.",
};
