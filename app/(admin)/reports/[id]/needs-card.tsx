"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Card, button } from "@/components/ui";
import { api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { settingsLink } from "../../settings-modal/links";
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
      <TestAccount programId={programId} />
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

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3.5 py-[11px] text-sm outline-none placeholder:text-faint focus:border-primary disabled:opacity-70";

/**
 * 테스트 계정 등록. "등록하기"를 누르면 아래로 입력칸이 펼쳐진다.
 * 계정을 저장하는 서버 API가 아직 없어(Metaphor-back#61) 저장 버튼은 막아 둔다.
 */
function TestAccount({ programId }: { programId: string }) {
  const [open, setOpen] = useState(false);
  const program = useQuery({
    queryKey: ["programs", programId],
    queryFn: () => api<Schemas["ProgramResponse"]>(`/programs/${encodeURIComponent(programId)}`),
  });
  const registered = program.data?.scope.has_session === true;

  return (
    <div className={`overflow-hidden rounded-lg bg-surface-inset ${open ? "border border-border-strong" : ""}`}>
      <div className="flex items-center justify-between gap-4 py-4 pr-4 pl-[18px]">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-semibold">테스트 계정 등록</span>
          <span className="text-[13px] text-subtle">
            {registered ? "이 사이트에는 로그인 세션이 등록돼 있어요" : "로그인이 필요한 화면을 재현할 때 써요"}
          </span>
        </div>
        <button
          type="button"
          className={button.ghost}
          aria-expanded={open}
          aria-controls="test-account-form"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "닫기" : "등록하기"}
        </button>
      </div>
      {open && (
        <form
          id="test-account-form"
          className="flex flex-col gap-4 px-[18px] pt-1 pb-[18px]"
          onSubmit={(event) => event.preventDefault()}
        >
          <span className="h-px bg-line" aria-hidden />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-label">로그인 아이디</span>
              <input className={`${inputClass} font-mono`} autoComplete="off" placeholder="qa-member@example.com" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-label">비밀번호</span>
              <input type="password" className={inputClass} autoComplete="new-password" />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-label">로그인 화면 주소 (선택)</span>
            <input className={`${inputClass} font-mono`} placeholder="/login" />
            <span className="text-xs text-muted">
              비워 두면 신고된 화면에서 로그인 화면으로 이동할 때 자동으로 찾아요.
            </span>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-xs text-muted">
              테스트 계정 저장 기능은 준비 중이에요. 비밀번호는 암호화해서 저장하고 재현할 때만 써요.
            </p>
            <div className="flex gap-2">
              <button type="button" className={button.ghost} onClick={() => setOpen(false)}>
                취소
              </button>
              <button type="submit" className={button.primary} disabled title="서버 준비 중">
                저장하고 다시 시도
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
