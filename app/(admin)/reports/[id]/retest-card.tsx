"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card, Icon, button, formatClock } from "@/components/ui";
import { api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { settingsLink } from "../../settings-modal/links";
import { JobRequestError } from "./job-actions";
import { isActiveJob, reportKeys } from "./queries";
import { Inset, formatDateTime, secondsBetween } from "./ui";

type Job = Schemas["JobOut"];

/** 수정 확인(retest)의 기준이 될 수 있는 판정. 서버도 같은 조건으로 막는다. */
const COMPARABLE_VERDICTS = ["reproduced", "not_reproduced"];

/**
 * 수정 확인: 재현에 성공한 절차를 승인된 테스트 빌드에 다시 돌린다.
 * 통과(재현 안 됨)하면 서버가 신고를 바로 마감한다.
 */
export function RetestCard({
  reportId,
  programId,
  baseline,
  retest,
}: {
  reportId: string;
  programId: string;
  /** 재현에 성공한 실행 */
  baseline: Job;
  /** 가장 최근 수정 확인 실행. 없으면 null */
  retest: Job | null;
}) {
  const { canReview } = useSession();
  const client = useQueryClient();
  const [choosing, setChoosing] = useState(false);
  const [version, setVersion] = useState("");
  // 이 화면에서 실행 중인 걸 본 수정 확인. 이 실행이 통과로 끝나면 결과 창을 띄운다.
  const [watching, setWatching] = useState<string | null>(null);
  if (retest && isActiveJob(retest.status) && watching !== retest.id) setWatching(retest.id);

  const program = useQuery({
    queryKey: ["programs", programId],
    queryFn: () => api<Schemas["ProgramResponse"]>(`/programs/${encodeURIComponent(programId)}`),
    enabled: choosing,
  });
  const start = useMutation({
    mutationFn: (appVersion: string) =>
      api<Schemas["JobQueued"]>(`/reports/${encodeURIComponent(reportId)}/validation-jobs`, {
        method: "POST",
        body: { mode: "retest", baseline_job_id: baseline.id, app_version: appVersion },
        idempotent: true,
      }),
    onSuccess: () => {
      setChoosing(false);
      return client.invalidateQueries({ queryKey: reportKeys.report(reportId) });
    },
  });

  const comparable =
    baseline.status === "completed" && baseline.verdict != null && COMPARABLE_VERDICTS.includes(baseline.verdict);
  const running = retest != null && isActiveJob(retest.status);
  const versions = program.data?.scope.approved_app_versions ?? [];
  const selected = versions.includes(version) ? version : (versions[0] ?? "");
  const passed = retest?.status === "completed" && retest.verdict === "not_reproduced";

  return (
    <Card
      title="수정 확인"
      description="실제 브라우저에서 같은 재현 절차를 다시 돌려 정말 고쳐졌는지 확인해요. 통과하면 이 버그는 마감돼요."
      tone="success"
      aside={
        canReview &&
        !choosing && (
          <button
            type="button"
            className={button.primary}
            disabled={!comparable || running}
            title={comparable ? undefined : "재현 여부가 확정된 실행이 있어야 수정 확인을 할 수 있어요."}
            onClick={() => setChoosing(true)}
          >
            {running ? "확인 중…" : "수정 확인 실행"}
          </button>
        )
      }
    >
      {choosing && (
        <Inset className="flex flex-wrap items-center gap-2 text-sm">
          {program.isPending ? (
            <span className="text-subtle">테스트 버전을 불러오는 중…</span>
          ) : program.isError ? (
            <span className="text-danger">사이트 정보를 불러오지 못했어요.</span>
          ) : versions.length === 0 ? (
            <span className="text-subtle">
              승인된 테스트 버전이 없어요.{" "}
              <Link href={settingsLink("site", programId)} className="font-medium text-primary-ink underline">
                사이트 설정
              </Link>
              에서 추가하세요.
            </span>
          ) : (
            <>
              <label htmlFor="retest-version" className="text-subtle">
                테스트 버전
              </label>
              <select
                id="retest-version"
                value={selected}
                onChange={(event) => setVersion(event.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-xs"
              >
                {versions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={button.primary}
                disabled={start.isPending || selected === ""}
                onClick={() => start.mutate(selected)}
              >
                {start.isPending ? "요청 중…" : "시작"}
              </button>
            </>
          )}
          <button
            type="button"
            className={`${button.ghost} ml-auto`}
            disabled={start.isPending}
            onClick={() => {
              setChoosing(false);
              start.reset();
            }}
          >
            그만두기
          </button>
        </Inset>
      )}
      {start.error && <JobRequestError error={start.error} prefix="수정 확인을 요청하지 못했어요." />}

      <Inset className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13px]">
        <span className="text-muted">마지막 실행</span>
        <LastRun retest={retest} />
      </Inset>

      {retest && passed && watching === retest.id && <PassedDialog job={retest} onClose={() => setWatching(null)} />}
    </Card>
  );
}

function LastRun({ retest }: { retest: Job | null }) {
  if (!retest) return <span className="font-medium text-label">아직 실행하지 않았어요</span>;
  if (isActiveJob(retest.status)) return <span className="font-medium text-label">확인하는 중이에요…</span>;
  const when = formatDateTime(retest.finished_at ?? retest.created_at);
  if (retest.status === "completed" && retest.verdict === "not_reproduced") {
    return (
      <span className="font-medium text-primary-ink">
        통과, 신고한 현상이 나오지 않았어요 <span className="text-muted">· {when}</span>
      </span>
    );
  }
  if (retest.verdict === "reproduced") {
    return (
      <span className="font-medium text-warning-ink">
        아직 같은 현상이 나와요 <span className="text-muted">· {when}</span>
      </span>
    );
  }
  return (
    <span className="font-medium text-label">
      판정하지 못했어요 <span className="text-muted">· {when}</span>
    </span>
  );
}

/**
 * 수정 확인 통과 안내. 지금 서버는 통과하면 바로 마감하므로 확인만 받는다.
 * 사람이 마감을 정하게 되면(Metaphor-back#57) "나중에 / 마감하기"로 바꾼다.
 */
function PassedDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const seconds = secondsBetween(job.started_at, job.finished_at);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="passed-title"
      onClose={onClose}
      className="m-auto w-[min(460px,calc(100vw-32px))] rounded-xl border border-border bg-surface px-7 pt-7 pb-6 text-foreground shadow-[0_16px_48px_rgb(0_0_0/0.45)] backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-5">
        <Icon name="check-circle-lg" size={36} />
        <div className="flex flex-col gap-2">
          <h2 id="passed-title" className="text-[22px] font-semibold">
            수정 확인을 통과했어요
          </h2>
          <p className="text-sm leading-[22px] text-body">
            같은 재현 절차를 테스트 빌드에서 다시 돌렸고, 신고한 현상이 나오지 않았어요. 이 버그는 마감됐어요.
          </p>
        </div>
        <Inset className="flex flex-col gap-2 text-[13px]">
          <Row label="결과" value={<span className="text-primary-ink">통과</span>} />
          {seconds !== null && <Row label="실행 시간" value={formatClock(seconds)} />}
          <Row label="마감 시각" value={formatDateTime(job.finished_at)} />
        </Inset>
        <p className="text-xs text-muted">마감된 제보는 목록에서 빠져요.</p>
        <div className="flex justify-end">
          <button type="button" className={button.primary} autoFocus onClick={() => dialog.current?.close()}>
            확인
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-body">{value}</span>
    </div>
  );
}
