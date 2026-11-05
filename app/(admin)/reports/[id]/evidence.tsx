import { Card, Icon } from "@/components/ui";
import type { Schemas } from "@/lib/api";
import type { ClientContext } from "@/types/report";
import { evidenceUrl } from "./queries";
import { Inset, Muted, formatTime } from "./ui";

type Report = Schemas["ReportDetail"];

const SCRUBBED_MESSAGE = "보관 기간이 지나 원문이 삭제됐어요.";

function contextOf(report: Report): ClientContext {
  return (report.client_context ?? {}) as ClientContext;
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

function envRows(report: Report): [string, string][] {
  const context = contextOf(report);
  const env = context.environment;
  const rows: [string, string][] = [];
  const path = pathOf(context.reported_url) ?? pathOf(report.target_url);
  if (path) rows.push(["발생 화면", path]);
  if (env?.user_agent) rows.push(["브라우저", describeUserAgent(env.user_agent)]);
  if (env?.viewport) rows.push(["화면 크기", `${env.viewport.width} × ${env.viewport.height}`]);
  if (env?.language) rows.push(["언어", env.language]);
  return rows;
}

/**
 * 신고자 증거: 스크린샷, 메모, 환경 정보. wide는 본문 칸, compact는 옆 칸.
 * 묶인 신고를 하나씩 넘겨 보는 기능은 서버에 원문이 없어 아직 못 한다(Metaphor-back#63).
 */
export function EvidenceCard({ report, compact }: { report: Report; compact?: boolean }) {
  const duplicates = report.duplicate_count;
  const description = `${formatTime(report.created_at)} 접수${duplicates > 0 ? `, 같은 신고 ${duplicates}건 더 있음` : ""}`;

  if (report.scrubbed) {
    return (
      <Card title="신고자 증거" description={description}>
        <Muted>{SCRUBBED_MESSAGE}</Muted>
      </Card>
    );
  }

  const screenshot = (
    <Screenshot artifactId={report.has_screenshot ? report.input_artifact_id : null} height={compact ? 170 : 200} />
  );
  const memo = (
    <Inset className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">신고자 메모</span>
      <p className="text-[15px] leading-6 font-medium whitespace-pre-wrap break-words">
        {report.description ? `“${report.description}”` : <span className="text-subtle">메모가 없어요.</span>}
      </p>
      {report.expected_result && (
        <p className="mt-1 text-[13px] leading-5 text-subtle">
          기대한 결과: <span className="text-label">{report.expected_result}</span>
        </p>
      )}
    </Inset>
  );
  const env = (
    <dl className={`grid gap-x-3 gap-y-2.5 text-sm ${compact ? "grid-cols-[72px_1fr]" : "grid-cols-[88px_1fr]"}`}>
      {envRows(report).map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 font-medium break-words text-body">{value}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <Card title="신고자 증거" description={description}>
      {compact ? (
        <div className="flex flex-col gap-3.5">
          {screenshot}
          {memo}
          {env}
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
          </div>
        </div>
      )}
    </Card>
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
  const error = report.scrubbed ? undefined : contextOf(report).error;
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
