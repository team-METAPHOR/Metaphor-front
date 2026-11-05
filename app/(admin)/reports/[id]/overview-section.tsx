import type { Schemas } from "@/lib/api";
import { WorkflowBadge } from "@/components/badge";
import * as labels from "@/lib/labels";
import { evidenceUrl } from "./queries";
import { Field, Fields, Muted, Prose, Section, formatDateTime } from "./ui";

export const SCRUBBED_MESSAGE = "보관 기간이 지나 원문이 삭제됐어요.";

export function OverviewSection({ report }: { report: Schemas["ReportDetail"] }) {
  const screenshotId = report.has_screenshot ? report.input_artifact_id : null;

  return (
    <Section title="개요">
      <Fields>
        <Field label="대상 URL">
          <span className="font-mono text-xs">{report.target_url}</span>
        </Field>
        <Field label="처리 상태">
          <WorkflowBadge value={report.workflow_status} />
        </Field>
        <Field label="유형">{labels.errorType(report.error_type).label}</Field>
        <Field label="유입 경로">{labels.source(report.source).label}</Field>
        <Field label="중복 신고">{report.duplicate_count}건</Field>
        <Field label="접수 시각">{formatDateTime(report.created_at)}</Field>
      </Fields>

      <div className="mt-6 border-t border-border pt-6">
        {report.scrubbed ? (
          <Muted>{SCRUBBED_MESSAGE}</Muted>
        ) : (
          <Fields>
            <Field label="설명">
              <Prose text={report.description} />
            </Field>
            <Field label="기대 결과">
              <Prose text={report.expected_result} />
            </Field>
            <Field label="테스트 데이터">
              <Prose text={report.test_data} />
            </Field>
          </Fields>
        )}
      </div>

      {screenshotId && (
        <div className="mt-6 border-t border-border pt-6">
          <p className="mb-2 text-sm text-muted">신고자 스크린샷</p>
          <a href={evidenceUrl(screenshotId)} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- 세션 쿠키가 필요한 같은 출처 이미지라 최적화 프록시를 거치지 않는다. */}
            <img
              src={evidenceUrl(screenshotId)}
              alt="신고자가 첨부한 스크린샷"
              className="max-h-72 rounded-lg border border-border"
            />
          </a>
        </div>
      )}
    </Section>
  );
}
