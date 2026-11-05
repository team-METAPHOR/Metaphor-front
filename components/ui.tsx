// 관리 화면 공용 조각. Figma "Report UI Components"(Status Badge, Button) 기준.

/**
 * 한 가지 색인 아이콘은 SVG를 마스크로 써서 테마 색을 입힌다. 값은 디자인의 기본 색.
 * 여기 없는 아이콘(초록 로고, 체크 원 등)은 두 테마에서 같은 색이라 그대로 그린다.
 */
const tintedIcons: Record<string, string> = {
  "arrow-right": "bg-label",
  "chevron-down": "bg-subtle",
  "select-chevron": "bg-subtle",
  "chevron-right-sm": "bg-faint",
  "page-prev": "bg-faint",
  "pager-prev": "bg-faint",
  image: "bg-faint",
  gear: "bg-label",
  "page-next": "bg-label",
  "pager-next": "bg-body",
  "nav-dashboard": "bg-foreground",
  "nav-report": "bg-foreground",
  play: "bg-foreground",
  "sidebar-collapse": "bg-foreground",
  signout: "bg-foreground",
  "step-todo": "bg-border-strong",
};

/** public/icons의 디자인 아이콘. 장식용이라 alt를 비운다. */
export function Icon({ name, size, className }: { name: string; size: number; className?: string }) {
  const tint = tintedIcons[name];
  if (tint) {
    const mask = `url(/icons/${name}.svg) center / contain no-repeat`;
    return (
      <span
        aria-hidden
        className={`inline-block shrink-0 ${tint} ${className ?? ""}`}
        style={{ width: size, height: size, mask, WebkitMask: mask }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 크기가 고정된 정적 SVG라 최적화가 필요 없다.
    <img src={`/icons/${name}.svg`} alt="" width={size} height={size} className={`shrink-0 ${className ?? ""}`} />
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2.5 text-[15px] leading-none transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export const button = {
  primary: `${buttonBase} bg-primary font-bold text-primary-foreground hover:brightness-110`,
  secondary: `${buttonBase} border border-border bg-surface font-medium text-foreground hover:bg-chip`,
  ghost: `${buttonBase} border border-border font-medium text-body hover:bg-chip`,
};

export function Card({
  title,
  description,
  aside,
  tone,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  /** 강조 테두리. success: 수정 확인, warning: 재현에 필요한 것 */
  tone?: "success" | "warning";
  className?: string;
  children?: React.ReactNode;
}) {
  const border =
    tone === "success" ? "border border-primary/45" : tone === "warning" ? "border border-warning/55" : "";
  return (
    <section className={`flex min-w-0 flex-col gap-4 rounded-xl bg-surface px-6 pt-[22px] pb-6 ${border} ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <div className="text-[13px] text-subtle">{description}</div>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

type BadgeStyle = { label: string; className: string };

const progressBadge: Record<string, BadgeStyle> = {
  new: { label: "신규", className: "border-[1.5px] border-border-strong text-label" },
  reproducing: { label: "재현 중", className: "bg-chip text-body" },
  reproduced: { label: "재현됨", className: "bg-primary text-primary-foreground" },
  triaged: { label: "재현 안 됨", className: "bg-warning text-primary-foreground" },
  fixing: { label: "버그 수정 중", className: "border-[1.5px] border-primary text-primary-ink" },
  dismissed: { label: "버그 아님·중복", className: "border-[1.5px] border-chip text-muted" },
  closed: { label: "마감", className: "bg-chip text-subtle" },
};

/** 진행 단계 배지. 모르는 값은 원문 그대로 보여준다. */
export function StatusBadge({ progress }: { progress: string }) {
  const style = progressBadge[progress] ?? { label: progress, className: "bg-chip text-body" };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-2.5 py-[5px] text-sm leading-none font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}

/** 이름 두 글자(영문은 이니셜)를 보여주는 동그란 자리표시. */
export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const words = name.trim().split(/[\s@._-]+/).filter(Boolean);
  const latin = /^[a-z]/i.test(name);
  const initials = latin
    ? words
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase()
    : name.trim().slice(-2);
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-border-strong font-semibold text-body"
    >
      {initials}
    </span>
  );
}

/** 오늘·어제는 "오늘 14:41", 그 밖에는 "11/3 09:12". */
export function formatShortTime(value: string | null | undefined, now = new Date()): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const time = date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86_400_000);
  if (diff === 0) return `오늘 ${time}`;
  if (diff === 1) return `어제 ${time}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}

/** 초 → "0:17" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
