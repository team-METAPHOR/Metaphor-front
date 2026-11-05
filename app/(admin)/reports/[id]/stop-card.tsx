"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, button } from "@/components/ui";
import type { Schemas } from "@/lib/api";
import { jobErrorReason, requiredAction, requiredActionTitle } from "@/lib/labels";
import { settingsLink, type SettingsTab } from "../../settings-modal/links";
import { Inset, formatTime } from "./ui";

type Report = Schemas["ReportDetail"];
type Job = Schemas["JobOut"];

/** 판정 없이 끝난 실행 상태. 진행 중 화면 대신 멈춘 이유와 다음 행동을 보여 준다. */
export const STOPPED_JOB_STATUSES: readonly string[] = ["failed", "cancelled", "inconclusive"];

/** 필요 조치를 고칠 수 있는 설정 탭. */
const ACTION_TABS: Record<string, SettingsTab> = {
  CHECK_TEST_ACCOUNT: "repro",
  TEST_ACCOUNT_REQUIRED: "repro",
  CHECK_TARGET_URL: "site",
  USE_HTTPS_FOR_CREDENTIALS: "site",
  VERIFY_ORIGIN: "site",
};

const INCONCLUSIVE_REASONS: Record<string, string> = {
  ATTEMPTS_DISAGREE: "두 번의 시도 결과가 달라 재현됐는지 판단하지 못했어요.",
  ATTEMPT_BLOCKED: "재현 시도가 중간에 막혀 판단하지 못했어요.",
};

/** 시각이 지났는지. 아직이면 그 시각에 다시 그린다. */
export function useReached(at: string | null | undefined): boolean {
  const target = at ? Date.parse(at) : NaN;
  const [now, setNow] = useState(() => Date.now());
  const reached = Number.isNaN(target) || target <= now;
  useEffect(() => {
    if (reached) return;
    // 서버는 24시간 넘는 대기를 주지 않으므로 setTimeout 한도 안이다.
    const timer = setTimeout(() => setNow(Date.now()), target - Date.now());
    return () => clearTimeout(timer);
  }, [reached, target]);
  return reached;
}

/** 실패, 취소, 판단 불가로 끝난 실행: 멈춘 이유와 사람이 할 일. */
export function StopCard({ report, job }: { report: Report; job: Job }) {
  const retryReady = useReached(job.retry_available_at);
  const code = job.error_code ?? job.backend_error_code;
  const stoppedAt = formatTime(job.finished_at ?? job.created_at);
  const reason = jobErrorReason(code);

  const { title, description, tone } =
    job.status === "cancelled"
      ? {
          title: "재현을 취소했어요",
          description: `${stoppedAt}에 취소했어요. ‘처음부터 다시 재현’을 누르면 처음부터 시작해요.`,
          tone: undefined,
        }
      : job.status === "inconclusive"
        ? {
            title: "재현 결과를 판단하지 못했어요",
            description:
              reason ??
              (job.reason_code && INCONCLUSIVE_REASONS[job.reason_code]) ??
              "신고와 같은 현상인지 판단하지 못했어요. 아래를 확인한 뒤 다시 재현하세요.",
            tone: "warning" as const,
          }
        : {
            title: "재현 실행이 실패했어요",
            description: `${stoppedAt}에 멈췄어요. ${reason ?? "아래를 확인한 뒤 다시 재현하세요."}`,
            tone: "danger" as const,
          };

  // 취소는 사람이 멈춘 것이라 서버 조치가 없다.
  const actions = job.status === "cancelled" ? [] : report.required_actions;

  return (
    <Card title={title} description={description} tone={tone}>
      {actions.map((action) => {
        const tab = ACTION_TABS[action.code];
        const waiting = action.code === "WAIT_FOR_PROVIDER" && job.retry_available_at;
        return (
          <Inset key={action.code} className="flex items-center justify-between gap-4 py-4 pr-4 pl-[18px]">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[15px] font-semibold">
                {waiting
                  ? retryReady
                    ? "이제 다시 재현할 수 있어요"
                    : `${formatTime(job.retry_available_at)} 이후 다시 재현할 수 있어요`
                  : requiredActionTitle(action.code)}
              </span>
              <span className="text-[13px] text-subtle">{requiredAction(action)}</span>
            </div>
            {tab && (
              <Link href={settingsLink(tab, report.program_id)} className={button.ghost}>
                설정 열기
              </Link>
            )}
          </Inset>
        );
      })}
      {code && <p className="text-xs text-muted">오류 코드 {code}</p>}
    </Card>
  );
}
