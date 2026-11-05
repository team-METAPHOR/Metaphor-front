import { useState } from "react";
import { Card, Icon } from "@/components/ui";
import type { Schemas } from "@/lib/api";
import type { ClientContext } from "@/types/report";
import { evidenceUrl, useDuplicates } from "./queries";
import { ErrorText, Inset, Muted, formatTime } from "./ui";

type Report = Schemas["ReportDetail"];
type Duplicate = Schemas["ReportDuplicateItem"];

const SCRUBBED_MESSAGE = "보관 기간이 지나 원문이 삭제됐어요.";

/** 증거 카드 한 장에 그리는 신고 한 건. 원 신고와 묶인 신고를 같은 모양으로 맞춘다. */
type Evidence = {
  receivedAt: string;
  description: string | null;
  expectedResult: string | null;
  screenshotId: string | null;
  context: ClientContext;
  /** 위젯이 주소를 안 남겼을 때 쓰는 대상 URL */
  fallbackUrl: string | null;
};

function fromReport(report: Report): Evidence {
  return {
    receivedAt: report.created_at,
    description: report.description || null,
    expectedResult: report.expected_result || null,
    screenshotId: report.has_screenshot ? report.input_artifact_id : null,
    context: (report.client_context ?? {}) as ClientContext,
    fallbackUrl: report.target_url,
  };
}

function fromDuplicate(item: Duplicate): Evidence {
  return {
    receivedAt: item.received_at,
    description: item.description || null,
    expectedResult: null,
    screenshotId: item.has_screenshot ? item.input_artifact_id : null,
    context: (item.client_context ?? {}) as ClientContext,
    fallbackUrl: null,
  };
}
/** "Chrome 132, macOS" 정도로 줄인다. 모르면 원문을 그대로 쓴다. */
export function describeUserAgent(ua: string): string {
  // 순서가 중요하다: Edge UA에는 Chrome이, Chrome UA에는 Safari가 들어 있다.
  const browsers: [string, RegExp][] = [
    ["Edge", /Edg\/(\d+)/],
    ["Chrome", /Chrome\/(\d+)/],
    ["Firefox", /Firefox\/(\d+)/],
    ["Safari", /Version\/(\d+).*Safari/],
  ];
  const systems: [string, RegExp][] = [
    ["iOS", /iPhone|iPad/],
    ["Android", /Android/],
    ["macOS", /Mac OS X/],
    ["Windows", /Windows/],
    ["Linux", /Linux/],
  ];
  const browser = browsers
    .map(([name, pattern]) => {
      const version = pattern.exec(ua)?.[1];
      return version ? `${name} ${version}` : null;
    })
    .find(Boolean);
  const os = systems.find(([, pattern]) => pattern.test(ua))?.[0];
  if (!browser) return ua;
  return os ? `${browser}, ${os}` : browser;
}

/** 쿼리를 뺀 경로만. URL이 아니면 그대로. */
function pathOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function envRows(evidence: Evidence): [string, string][] {
  const env = evidence.context.environment;
  const rows: [string, string][] = [];
  const path = pathOf(evidence.context.reported_url) ?? pathOf(evidence.fallbackUrl ?? undefined);
  if (path) rows.push(["발생 화면", path]);
  if (env?.user_agent) rows.push(["브라우저", describeUserAgent(env.user_agent)]);
  if (env?.viewport) rows.push(["화면 크기", `${env.viewport.width} × ${env.viewport.height}`]);
  if (env?.language) rows.push(["언어", env.language]);
  return rows;
}

/**
 * 신고자 증거: 스크린샷, 메모, 환경 정보. wide는 본문 칸, compact는 옆 칸.
 * 같은 신고로 묶인 제보가 있으면 원 신고부터 하나씩 넘겨 본다.
 */
export function EvidenceCard({ report, compact }: { report: Report; compact?: boolean }) {
  const extra = report.duplicate_count;
  const duplicates = useDuplicates(report.id, extra > 0 && !report.scrubbed);
  const [index, setIndex] = useState(0);

  if (report.scrubbed) {
    return (
      <Card title="신고자 증거" description={`${formatTime(report.created_at)} 접수`}>
        <Muted>{SCRUBBED_MESSAGE}</Muted>
      </Card>
    );
  }

  const stored = duplicates.data?.items ?? [];
  const pages: Evidence[] = [fromReport(report), ...stored.map(fromDuplicate)];
  const current = Math.min(index, pages.length - 1);
  const evidence = pages[current];
  // 서버는 묶인 신고 중 앞의 몇 건만 원문을 보관한다.
  const missing = duplicates.isSuccess ? extra - stored.length : 0;

  const description =
    extra === 0
      ? `${formatTime(evidence.receivedAt)} 접수`
      : `${formatTime(evidence.receivedAt)} 접수 · ${current === 0 ? `원 신고, 같은 신고 ${extra}건 더 있음` : "같은 신고"}`;

  const pager = extra > 0 && (
    <Pager
      current={current}
      total={duplicates.isSuccess ? pages.length : 1 + extra}
      disabled={!duplicates.isSuccess}
      onChange={setIndex}
    />
  );

  const screenshot = <Screenshot artifactId={evidence.screenshotId} height={compact ? 170 : 200} />;
  const memo = (
    <Inset className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">신고자 메모</span>
      <p className="text-[15px] leading-6 font-medium whitespace-pre-wrap break-words">
        {evidence.description ? `“${evidence.description}”` : <span className="text-subtle">메모가 없어요.</span>}
      </p>
      {evidence.expectedResult && (
        <p className="mt-1 text-[13px] leading-5 text-subtle">
          기대한 결과: <span className="text-label">{evidence.expectedResult}</span>
        </p>
      )}
    </Inset>
  );
  const env = (
    <dl className={`grid gap-x-3 gap-y-2.5 text-sm ${compact ? "grid-cols-[72px_1fr]" : "grid-cols-[88px_1fr]"}`}>
      {envRows(evidence).map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 font-medium break-words text-body">{value}</dd>
        </div>
      ))}
    </dl>
  );
  const notes = (
    <>
      {duplicates.isError && <ErrorText error={duplicates.error} prefix="같은 신고를 불러오지 못했어요." />}
      {missing > 0 && current === pages.length - 1 && (
        <p className="text-xs text-muted">나머지 {missing}건은 원문을 보관하지 않아 건수만 남아 있어요.</p>
      )}
    </>
  );

  return (
    <Card title="신고자 증거" description={description} aside={pager}>
      {compact ? (
        <div className="flex flex-col gap-3.5">
          {screenshot}
          {memo}
          {env}
          {notes}
        </div>
      ) : (
        <div className="flex flex-col gap-5 md:flex-row">
          <div className="flex shrink-0 flex-col gap-2 md:w-80">
            {screenshot}
            <p className="text-xs text-muted">누르면 크게 보여요. 민감한 영역은 수집할 때 가려집니다.</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
            {memo}
            {env}
            {notes}
          </div>
        </div>
      )}
    </Card>
  );
}

/** 원 신고(1)부터 묶인 신고까지 한 건씩 넘긴다. */
function Pager({
  current,
  total,
  disabled,
  onChange,
}: {
  current: number;
  total: number;
  disabled: boolean;
  onChange: (index: number) => void;
}) {
  const arrow =
    "flex size-8 items-center justify-center rounded-lg hover:bg-chip disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <nav aria-label="같은 신고 넘겨 보기" className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className={arrow}
        disabled={disabled || current === 0}
        onClick={() => onChange(current - 1)}
        aria-label="이전 신고"
      >
        <Icon name="page-prev" size={16} />
      </button>
      <span className="min-w-12 text-center text-sm tabular-nums text-subtle" aria-live="polite">
        <span className="font-semibold text-foreground">{current + 1}</span> / {total}
      </span>
      <button
        type="button"
        className={arrow}
        disabled={disabled || current >= total - 1}
        onClick={() => onChange(current + 1)}
        aria-label="다음 신고"
      >
        <Icon name="page-next" size={16} />
      </button>
    </nav>
  );
}

function Screenshot({ artifactId, height }: { artifactId: string | null; height: number }) {
  if (!artifactId) {
    return (
      <div
        style={{ height }}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-chip bg-background"
      >
        <Icon name="image" size={28} />
        <span className="text-xs text-faint">스크린샷 없음</span>
      </div>
    );
  }
  return (
    <a
      href={evidenceUrl(artifactId)}
      target="_blank"
      rel="noreferrer"
      style={{ height }}
      className="block w-full overflow-hidden rounded-lg border border-chip bg-background"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 세션 쿠키가 필요한 같은 출처 이미지라 최적화 프록시를 거치지 않는다. */}
      <img
        src={evidenceUrl(artifactId)}
        alt="신고자가 첨부한 스크린샷"
        className="size-full object-cover object-top"
      />
    </a>
  );
}

/** 위젯이 잡은 오류로 원인을 짐작한다. 재현으로 확인한 내용이 아니다. */
export function LogEstimateCard({ report }: { report: Report }) {
  const error = report.scrubbed ? undefined : (report.client_context as ClientContext | null)?.error;
  if (!error) return null;
  const http = error.http;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          로그 기반 추정
          <span className="rounded-md bg-chip px-2 py-[3px] text-[11px] font-medium text-label">추정</span>
        </span>
      }
    >
      <p className="-mt-1 text-[15px] leading-6 font-medium break-words">
        {http ? (
          <>
            신고 시각에 <code className="font-mono text-sm">{`${http.method} ${http.path}`}</code> 요청이{" "}
            {http.status}로 끝났어요.
          </>
        ) : (
          <>
            신고 시각에 오류가 났어요: <code className="font-mono text-sm">{error.message}</code>
          </>
        )}
      </p>
      <p className="text-xs leading-[19px] text-muted">재현으로 확인한 내용은 아니에요. 참고용으로만 보세요.</p>
    </Card>
  );
}
