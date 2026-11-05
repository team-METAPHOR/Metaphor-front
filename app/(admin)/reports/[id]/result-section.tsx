"use client";

import type { Schemas } from "@/lib/api";
import { Badge, VerdictBadge } from "@/components/badge";
import * as labels from "@/lib/labels";
import type { EngineResult } from "@/types/report";
import { evidenceUrl, useArtifacts } from "./queries";
import { ErrorText, Muted, Section, formatBytes, formatDateTime } from "./ui";

type Run = NonNullable<NonNullable<EngineResult["report"]>["run"]>;
type Evidence = Run["evidence"][number];

export function ResultSection({
  job,
  result,
  resultError,
  resultPending,
}: {
  job: Schemas["JobOut"];
  result: EngineResult | null | undefined;
  resultError: unknown;
  resultPending: boolean;
}) {
  const run = result?.report?.run;
  const verdictValue = run?.verdict?.value ?? job.verdict;
  const reason = run?.verdict?.reason_code ?? job.reason_code;

  return (
    <Section title="검증 결과">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">재현 판정</span>
        <VerdictBadge value={verdictValue} />
        {reason && <span>{labels.reasonCode(reason).label}</span>}
      </div>
      {verdictValue === "not_reproduced" && (
        <p className="mt-2 text-xs text-muted">재현되지 않았다는 뜻이며, 버그가 없다는 판정은 아니에요.</p>
      )}

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium">시도별 결과</h3>
        {resultPending ? (
          <Muted>불러오는 중…</Muted>
        ) : resultError ? (
          <ErrorText error={resultError} prefix="결과를 불러오지 못했어요." />
        ) : result == null ? (
          <Muted>결과 대기 중이에요.</Muted>
        ) : run?.evidence?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {run.evidence.map((evidence) => (
              <AttemptCard key={evidence.id ?? evidence.attempt} evidence={evidence} />
            ))}
          </div>
        ) : (
          <Muted>시도 기록이 없어요.</Muted>
        )}
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <Artifacts jobId={job.id} />
      </div>
    </Section>
  );
}

function observation(value: boolean | null | undefined) {
  if (value === true) return <Badge tone="danger">관찰됨</Badge>;
  if (value === false) return <Badge tone="neutral">미관찰</Badge>;
  return <Badge tone="warning">확인 불가</Badge>;
}

function expectation(value: boolean | null | undefined) {
  if (value === true) return <Badge tone="success">관찰됨</Badge>;
  if (value === false) return <Badge tone="neutral">미관찰</Badge>;
  return <Badge tone="warning">확인 불가</Badge>;
}

function AttemptCard({ evidence }: { evidence: Evidence }) {
  return (
    <div className="rounded-xl border border-border p-4 text-sm">
      <p className="font-medium">{evidence.attempt}번째 시도</p>
      <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-2">
        <dt className="text-muted">완료한 단계</dt>
        <dd>{evidence.completed_steps ?? "-"}</dd>
        <dt className="text-muted">증상</dt>
        <dd>{observation(evidence.symptom_observed)}</dd>
        <dt className="text-muted">기대 결과</dt>
        <dd>{expectation(evidence.expected_observed)}</dd>
        {evidence.blocker && (
          <>
            <dt className="text-muted">막힌 이유</dt>
            <dd className="break-words">{evidence.blocker}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

const artifactKind: Record<string, string> = {
  screenshot: "스크린샷",
  report_md: "보고서(Markdown)",
  json: "결과 JSON",
};

function Artifacts({ jobId }: { jobId: string }) {
  const artifacts = useArtifacts(jobId);
  if (artifacts.isPending) return <Muted>증거 자료를 불러오는 중…</Muted>;
  if (artifacts.isError) return <ErrorText error={artifacts.error} prefix="증거 자료를 불러오지 못했어요." />;

  const screenshots = artifacts.data.items.filter((item) => item.kind === "screenshot");
  const files = artifacts.data.items.filter((item) => item.kind !== "screenshot");

  return (
    <>
      <h3 className="mb-3 text-sm font-medium">재현 스크린샷</h3>
      {screenshots.length === 0 ? (
        <Muted>스크린샷이 없어요.</Muted>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {screenshots.map((item) => (
            <li key={item.id}>
              <a href={evidenceUrl(item.id)} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- 세션 쿠키가 필요한 같은 출처 이미지라 최적화 프록시를 거치지 않는다. */}
                <img
                  src={evidenceUrl(item.id)}
                  alt={`재현 스크린샷 (${formatDateTime(item.created_at)})`}
                  loading="lazy"
                  className="aspect-video w-full rounded-lg border border-border object-cover object-top"
                />
              </a>
              <p className="mt-1 text-xs text-muted">{formatDateTime(item.created_at)}</p>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <>
          <h3 className="mt-6 mb-3 text-sm font-medium">파일</h3>
          <ul className="space-y-1 text-sm">
            {files.map((item) => (
              <li key={item.id}>
                <a href={evidenceUrl(item.id)} download className="text-primary hover:underline">
                  {artifactKind[item.kind] ?? item.kind} 내려받기
                </a>
                <span className="ml-2 text-xs text-muted">{formatBytes(item.size)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
