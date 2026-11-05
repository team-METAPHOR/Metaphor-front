"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { reportKeys } from "./queries";
import { AiTag, ErrorText, Muted, Section, buttonClass } from "./ui";

const MAX_ANSWER = 4000;

/** job이 needs_info일 때 AI 질문에 답한다. 답하면 새 job이 생기고 신고의 latest_job이 그 job을 가리킨다. */
export function ClarificationSection({
  reportId,
  jobId,
  questions,
}: {
  reportId: string;
  jobId: string;
  questions: string[];
}) {
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
    onSuccess: () => client.invalidateQueries({ queryKey: reportKeys.report(reportId) }),
  });

  return (
    <Section title="AI 질문" aside={<AiTag />}>
      <p className="mb-3 text-sm">재현에 필요한 정보가 부족해요. 아래 질문에 답하면 검증을 이어서 진행해요.</p>
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm">
        {questions.map((question, index) => (
          <li key={index} className="break-words">
            {question}
          </li>
        ))}
      </ol>

      {canReview ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (answers.trim()) submit.mutate();
          }}
        >
          <label htmlFor="clarification-answers" className="mb-1 block text-sm font-medium">
            답변
          </label>
          <textarea
            id="clarification-answers"
            value={answers}
            onChange={(event) => setAnswers(event.target.value)}
            maxLength={MAX_ANSWER}
            rows={5}
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted">
              {answers.length}/{MAX_ANSWER}
            </span>
            <button type="submit" className={buttonClass.primary} disabled={submit.isPending || !answers.trim()}>
              {submit.isPending ? "보내는 중…" : "답변하고 검증 이어가기"}
            </button>
          </div>
          {submit.error && <ErrorText error={submit.error} prefix="답변을 보내지 못했어요." />}
        </form>
      ) : (
        <Muted>답변은 검토자 또는 관리자만 할 수 있어요.</Muted>
      )}
    </Section>
  );
}
