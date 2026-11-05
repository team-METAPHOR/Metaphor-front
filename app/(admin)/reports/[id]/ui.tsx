import { ApiError } from "@/lib/api";

export function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-subtle">{children}</p>;
}

export function ErrorText({ error, prefix }: { error: unknown; prefix: string }) {
  const message = error instanceof Error ? error.message : String(error);
  const requestId = error instanceof ApiError ? error.requestId : null;
  return (
    <p role="alert" className="text-sm text-danger">
      {prefix} ({message}){requestId ? ` · 요청 ID ${requestId}` : ""}
    </p>
  );
}

/** 카드 안의 한 칸 짜리 회색 상자 (메모, 마지막 실행 등) */
export function Inset({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-lg bg-surface-inset px-4 py-3.5 ${className ?? ""}`}>{children}</div>;
}

/** 라벨 위, 값 아래로 쌓는 작은 항목 */
export function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

const time = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
const dateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

/** "14:27" */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : time.format(date);
}

/** "14:27 - 14:31". 같은 분이면 하나만. */
export function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return "";
  const from = formatTime(start);
  const to = end ? formatTime(end) : "";
  return to && to !== from ? `${from} - ${to}` : from;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

/** 두 시각 사이 초. 하나라도 없으면 null */
export function secondsBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const ms = Date.parse(end) - Date.parse(start);
  return Number.isFinite(ms) && ms >= 0 ? ms / 1000 : null;
}
