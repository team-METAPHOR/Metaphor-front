// 설정 모달 안의 공용 조각. Figma "설정 · …" 프레임 기준.

export function Section({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3 pb-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-base font-semibold">{title}</h3>
          {description && <p className="text-[13px] leading-5 text-muted">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function SettingRow({
  label,
  help,
  first,
  children,
}: {
  label: string;
  help?: React.ReactNode;
  first?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between gap-6 py-3.5 ${first ? "" : "border-t border-line"}`}>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-body">{label}</span>
        {help && <span className="text-xs leading-[18px] text-muted">{help}</span>}
      </div>
      {children}
    </div>
  );
}

export const modalInput =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-body outline-none placeholder:text-faint focus:border-primary disabled:opacity-70";

/** 서버 기능이 아직 없어 화면만 있는 영역 안내. */
export function NotReady({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-ink">{children}</p>
  );
}

export function Toggle({ on, label, disabled }: { on: boolean; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`relative h-[22px] w-10 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${on ? "bg-primary" : "bg-chip"}`}
    >
      <span
        className={`absolute top-[3px] size-4 rounded-full transition-[left] ${on ? "left-[21px] bg-primary-foreground" : "left-[3px] bg-subtle"}`}
      />
    </button>
  );
}
