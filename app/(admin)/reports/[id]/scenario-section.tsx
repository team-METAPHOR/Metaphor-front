import type { EngineResult } from "@/types/report";
import { AiTag, ErrorText, Field, Fields, Muted, Section } from "./ui";

const actionLabel: Record<string, string> = {
  navigate: "페이지 이동",
  click: "클릭",
  fill: "입력",
  assert_text: "텍스트 확인",
};

export function ScenarioSection({
  result,
  resultError,
  resultPending,
}: {
  result: EngineResult | null | undefined;
  resultError: unknown;
  resultPending: boolean;
}) {
  const intake = result?.report?.intake;
  const steps = result?.report?.scenario?.steps ?? [];

  return (
    <Section title="재현 절차" aside={<AiTag />}>
      {resultPending ? (
        <Muted>불러오는 중…</Muted>
      ) : resultError ? (
        <ErrorText error={resultError} prefix="결과를 불러오지 못했어요." />
      ) : result == null ? (
        <Muted>결과 대기 중이에요.</Muted>
      ) : (
        <>
          <h3 className="mb-3 text-sm font-medium">엔진이 해석한 신고</h3>
          {intake ? (
            <Fields>
              <Field label="기대 동작">{intake.expected_behavior || "-"}</Field>
              <Field label="증상">{intake.symptom_description || "-"}</Field>
              <Field label="관찰 사실">
                {intake.observed_facts?.length ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {intake.observed_facts.map((fact, index) => (
                      <li key={index}>{fact}</li>
                    ))}
                  </ul>
                ) : (
                  "-"
                )}
              </Field>
            </Fields>
          ) : (
            <Muted>해석 정보가 없어요.</Muted>
          )}

          <h3 className="mt-6 mb-3 text-sm font-medium">단계</h3>
          {steps.length === 0 ? (
            <Muted>재현 단계가 없어요.</Muted>
          ) : (
            <ol className="space-y-2 text-sm">
              {steps.map((step, index) => (
                <li key={index} className="flex gap-3 rounded-lg bg-background px-3 py-2">
                  <span className="w-5 shrink-0 text-muted tabular-nums">{index + 1}</span>
                  <span className="w-20 shrink-0 font-medium">{actionLabel[step.action] ?? step.action}</span>
                  <span className="min-w-0 flex-1 break-words">
                    <span className="font-mono text-xs">{step.target}</span>
                    {step.value && <span className="ml-2 text-muted">“{step.value}”</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Section>
  );
}
