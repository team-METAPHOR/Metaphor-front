import type { Schemas } from "@/lib/api";
import type { ClientContext } from "@/types/report";
import { SCRUBBED_MESSAGE } from "./overview-section";
import { Field, Fields, Muted, Section } from "./ui";

export function EnvironmentSection({ report }: { report: Schemas["ReportDetail"] }) {
  if (report.scrubbed) {
    return (
      <Section title="환경 정보">
        <Muted>{SCRUBBED_MESSAGE}</Muted>
      </Section>
    );
  }

  const context = (report.client_context ?? null) as ClientContext | null;
  if (!context || Object.keys(context).length === 0) {
    return (
      <Section title="환경 정보">
        <Muted>수집된 환경 정보가 없어요.</Muted>
      </Section>
    );
  }

  const { environment, error } = context;
  const http = error?.http;

  return (
    <Section title="환경 정보">
      <Fields stacked>
        <Field label="신고 위치">
          <span className="font-mono text-xs">{context.reported_url ?? "-"}</span>
          {context.query_stripped && <span className="ml-2 text-xs text-muted">(쿼리 제거됨)</span>}
        </Field>
        {environment && (
          <>
            <Field label="브라우저">
              <span className="text-xs">{environment.user_agent || "-"}</span>
            </Field>
            <Field label="언어">{environment.language || "-"}</Field>
            <Field label="시간대">{environment.timezone || "-"}</Field>
            <Field label="화면 크기">
              {environment.viewport ? `${environment.viewport.width} × ${environment.viewport.height}` : "-"}
            </Field>
          </>
        )}
      </Fields>

      {error && (
        <div className="mt-6 border-t border-border pt-6">
          <h3 className="mb-3 text-sm font-medium">감지된 오류</h3>
          <Fields stacked>
            <Field label="메시지">
              <span className="font-mono text-xs">{error.message}</span>
            </Field>
            {error.stack_top && (
              <Field label="스택">
                <span className="font-mono text-xs">{error.stack_top}</span>
              </Field>
            )}
            {http && (
              <Field label="HTTP 요청">
                <span className="font-mono text-xs">
                  {http.method} {http.path} → {http.status}
                </span>
              </Field>
            )}
          </Fields>
        </div>
      )}
    </Section>
  );
}
