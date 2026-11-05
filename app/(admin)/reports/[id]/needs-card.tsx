"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Card, button } from "@/components/ui";
import { api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { settingsLink } from "../../settings-modal/links";
import { TestAccountForm, notInUseReason, useTestAccount } from "../../settings/test-account-form";
import { RevalidateButton } from "./job-actions";
import { reportKeys, useHandoff } from "./queries";
import { ErrorText, Inset } from "./ui";

type Job = Schemas["JobOut"];

const MAX_ANSWER = 4000;

/**
 * 재현되지 않았거나 정보가 필요할 때 사람이 채울 것: AI 질문 답변, 부족한 정보,
 * 테스트 계정, 스테이징 주소.
 */
export function NeedsCard({ reportId, programId, job }: { reportId: string; programId: string; job: Job }) {
  const handoff = useHandoff(reportId);
  const missing = handoff.data?.state === "ready" ? handoff.data.missing_information : [];
  const asking = job.status === "needs_info" && job.questions.length > 0;

  const description = asking
    ? "AI가 재현에 필요한 정보를 물어봤어요. 답하면 같은 절차로 이어서 다시 시도해요."
    : job.reason_code === "ATTEMPT_BLOCKED"
      ? "재현 시도가 중간에 막혔어요. 아래 정보를 채우면 같은 절차로 다시 시도해요."
      : "같은 현상이 나오지 않았어요. 아래 정보를 채우면 다시 시도할 수 있어요.";

  return (
    <Card title="재현하려면 이것이 필요해요" description={description} tone="warning">
      {asking && <Questions reportId={reportId} jobId={job.id} questions={job.questions} />}
      {missing.length > 0 && (
        <Inset className="flex flex-col gap-2">
          <span className="text-xs text-muted">AI가 찾은 부족한 정보</span>
          <ul className="list-disc space-y-1 pl-5 text-sm text-label">
            {missing.map((item, index) => (
              <li key={index} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        </Inset>
      )}
      <TestAccount reportId={reportId} programId={programId} />
      <Inset className="flex items-center justify-between gap-4 py-4 pr-4 pl-[18px]">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-semibold">스테이징 주소 지정</span>
          <span className="text-[13px] text-subtle">운영 사이트 대신 안전한 환경에서 실행해요</span>
        </div>
        <Link href={settingsLink("repro", programId)} className={button.ghost}>
          입력하기
        </Link>
      </Inset>
    </Card>
  );
}

function Questions({ reportId, jobId, questions }: { reportId: string; jobId: string; questions: string[] }) {
  const { canReview } = useSession();
  const client = useQueryClient();
  const [answers, setAnswers] = useState("");
  const submit = useMutation({
    mutationFn: () =>
      api<{ validation_job_id: string }>(`/reports/${encodeURIComponent(reportId)}/clarifications`, {
        method: "POST",
        body: { source_job_id: jobId, answers: answers.trim() },
        idempotent: true,
      }),
    // 답하면 새 job이 생기고 신고의 latest_job이 그 job을 가리킨다.
    onSuccess: () => client.invalidateQueries({ queryKey: reportKeys.report(reportId) }),
  });

  return (
    <Inset className="flex flex-col gap-3 border border-border-strong p-[18px]">
      <span className="text-[15px] font-semibold">AI 질문</span>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-label">
        {questions.map((question, index) => (
          <li key={index} className="break-words">
            {question}
          </li>
        ))}
      </ol>
      {canReview ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (answers.trim()) submit.mutate();
          }}
        >
          <label htmlFor="clarification-answers" className="text-[13px] font-medium text-label">
            답변
          </label>
          <textarea
            id="clarification-answers"
            value={answers}
            onChange={(event) => setAnswers(event.target.value)}
            maxLength={MAX_ANSWER}
            rows={4}
            required
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted tabular-nums">
              {answers.length}/{MAX_ANSWER}
            </span>
            <button type="submit" className={button.primary} disabled={submit.isPending || !answers.trim()}>
              {submit.isPending ? "보내는 중…" : "답하고 다시 시도"}
            </button>
          </div>
          {submit.error && <ErrorText error={submit.error} prefix="답변을 보내지 못했어요." />}
        </form>
      ) : (
        <p className="text-xs text-muted">답변은 검토자 또는 관리자만 할 수 있어요.</p>
      )}
    </Inset>
  );
}

/**
 * 테스트 계정 등록·수정. "등록하기"를 누르면 아래로 설정 모달과 같은 입력 폼이 펼쳐진다.
 * 저장하면 같은 자리에서 처음부터 다시 재현을 요청할 수 있다. 등록은 관리자만 한다.
 */
function TestAccount({ reportId, programId }: { reportId: string; programId: string }) {
  const { isAdmin } = useSession();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const account = useTestAccount(programId);
  const program = useQuery({
    queryKey: ["programs", programId],
    queryFn: () => api<Schemas["ProgramResponse"]>(`/programs/${encodeURIComponent(programId)}`),
  });
  const data = account.data;
  const configured = data?.configured === true;
  const scope = program.data?.scope;

  const status = !data
    ? "로그인이 필요한 화면을 재현할 때 써요"
    : configured
      ? data.in_use
        ? `${data.login_id_masked ?? "저장된 계정"}으로 로그인해서 재현해요`
        : `저장됐지만 실행에 쓰이지 않아요. ${notInUseReason(data, scope)}`
      : scope?.has_session
        ? "운영자가 연결한 로그인 세션으로 재현해요"
        : "로그인이 필요한 화면을 재현할 때 써요";

  return (
    <div className={`rounded-lg bg-surface-inset ${open ? "border border-border-strong" : ""}`}>
      <div className="flex items-center justify-between gap-4 py-4 pr-4 pl-[18px]">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-semibold">{configured ? "테스트 계정" : "테스트 계정 등록"}</span>
          <span className={`text-[13px] ${configured && data && !data.in_use ? "text-warning-ink" : "text-subtle"}`}>
            {status}
          </span>
          {account.isError && <ErrorText error={account.error} prefix="테스트 계정을 불러오지 못했어요." />}
        </div>
        {isAdmin ? (
          data && (
            <button
              type="button"
              className={button.ghost}
              aria-expanded={open}
              aria-controls="test-account-form"
              onClick={() => {
                setOpen((value) => !value);
                setSaved(false);
              }}
            >
              {open ? "닫기" : configured ? "수정하기" : "등록하기"}
            </button>
          )
        ) : (
          <span className="shrink-0 text-xs text-muted">관리자만 등록할 수 있어요</span>
        )}
      </div>
      {open && data && (
        <div id="test-account-form" className="flex flex-col gap-4 px-[18px] pt-1 pb-[18px]">
          <span className="h-px bg-line" aria-hidden />
          <TestAccountForm
            programId={programId}
            account={data}
            submitLabel="저장"
            onCancel={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              setSaved(true);
            }}
          />
        </div>
      )}
      {saved && !open && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-4">
          <p role="status" className="min-w-0 flex-1 text-[13px] text-label">
            테스트 계정을 저장했어요. 처음부터 다시 재현하면 이 계정으로 로그인해요.
          </p>
          <RevalidateButton reportId={reportId} programId={programId} label="다시 재현" primary />
        </div>
      )}
    </div>
  );
}
