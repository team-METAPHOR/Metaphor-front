import { ApiError } from "@/lib/api";

export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** stacked: 좁은 옆 칸용. 라벨을 값 위에 둔다. */
export function Fields({ children, stacked }: { children: React.ReactNode; stacked?: boolean }) {
  const columns = stacked ? "grid-cols-1 gap-y-1 [&>dd]:mb-2" : "grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[8rem_1fr]";
  return <dl className={`grid text-sm ${columns}`}>{children}</dl>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

/** 사용자가 쓴 긴 글. 줄바꿈을 살린다. */
export function Prose({ text }: { text: string | null | undefined }) {
  if (!text) return <span className="text-muted">-</span>;
  return <p className="whitespace-pre-wrap break-words">{text}</p>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export function AiTag() {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
      AI 생성
    </span>
  );
}

export function ErrorText({ error, prefix }: { error: unknown; prefix: string }) {
  const message = error instanceof Error ? error.message : String(error);
  const requestId = error instanceof ApiError ? error.requestId : null;
  return (
    <p className="text-sm text-red-600">
      {prefix} ({message}){requestId ? ` · 요청 ID ${requestId}` : ""}
    </p>
  );
}

const dateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "medium" });

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export const buttonClass = {
  primary:
    "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "rounded-lg border border-red-200 bg-surface px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50",
};
