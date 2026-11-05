"use client";

import { ClassificationBadge } from "@/components/badge";
import { useHandoff } from "./queries";
import { AiTag, ErrorText, Field, Fields, Muted, Section } from "./ui";

const stateMessage: Record<string, string> = {
  pending: "분석 중이에요.",
  unavailable: "분석이 없어요.",
  expired: "보관 기간이 지나 분석이 만료됐어요.",
};

export function AnalysisSection({ reportId }: { reportId: string }) {
  const handoff = useHandoff(reportId);

  return (
    <Section title="AI 분석" aside={<AiTag />}>
      {handoff.isPending ? (
        <Muted>불러오는 중…</Muted>
      ) : handoff.isError ? (
        <ErrorText error={handoff.error} prefix="분석을 불러오지 못했어요." />
      ) : handoff.data.state !== "ready" ? (
        <Muted>{stateMessage[handoff.data.state] ?? handoff.data.state}</Muted>
      ) : (
        <Ready data={handoff.data} />
      )}
    </Section>
  );
}

function Ready({ data }: { data: NonNullable<ReturnType<typeof useHandoff>["data"]> }) {
  return (
    <div className="space-y-6 text-sm">
      <Fields>
        <Field label="분류">
          <ClassificationBadge value={data.classification} />
        </Field>
        <Field label="심각도">{data.severity ?? "-"}</Field>
        <Field label="확신도">{data.confidence ?? "-"}</Field>
        <Field label="요약">
          <p className="whitespace-pre-wrap break-words">{data.summary ?? "-"}</p>
        </Field>
      </Fields>

      <div>
        <h3 className="mb-2 font-medium">원인 가설</h3>
        {data.hypotheses.length === 0 ? (
          <Muted>가설이 없어요.</Muted>
        ) : (
          <ol className="list-decimal space-y-1 pl-5">
            {data.hypotheses.map((hypothesis, index) => (
              <li key={index} className="break-words">
                {hypothesis.description}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-medium">해결 방안</h3>
        {data.solutions.length === 0 ? (
          <Muted>해결 방안이 없어요.</Muted>
        ) : (
          <div className="space-y-3">
            {data.solutions.map((solution, index) => (
              <div key={index} className="rounded-xl border border-border p-4">
                <p className="font-medium break-words">{solution.title}</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{solution.description}</p>
                <TextList title="확인 방법" items={solution.verification_steps} ordered />
                <TextList title="고려할 점" items={solution.tradeoffs} />
              </div>
            ))}
          </div>
        )}
      </div>

      {data.missing_information.length > 0 && <TextList title="부족한 정보" items={data.missing_information} />}
    </div>
  );
}

function TextList({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (items.length === 0) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted">{title}</p>
      <List className={`mt-1 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
        {items.map((item, index) => (
          <li key={index} className="break-words">
            {item}
          </li>
        ))}
      </List>
    </div>
  );
}
