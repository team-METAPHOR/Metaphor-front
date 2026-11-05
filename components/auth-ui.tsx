// 로그인·회원가입·조직 시작 화면 공용 조각. Figma "Auth · 로그인/회원가입/조직 없음" 기준.

import { Logo } from "./ui";

export const authInput =
  "w-full rounded-lg border border-border bg-background px-3.5 py-[11px] text-[15px] text-body outline-none placeholder:text-faint focus:border-primary aria-invalid:border-danger";

export const authSubmit =
  "w-full rounded-lg bg-primary px-4 py-3 text-[15px] font-bold text-primary-foreground transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

/** 가운데 정렬 화면: 로고 아래 카드 하나. */
export function AuthShell({ wide, children }: { wide?: boolean; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 px-4 py-12">
      <Logo />
      <div
        className={`flex w-full flex-col gap-6 rounded-xl border border-edge bg-surface px-8 pt-8 pb-7 ${wide ? "max-w-[480px]" : "max-w-[400px]"}`}
      >
        {children}
      </div>
    </main>
  );
}

export function AuthHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm leading-[22px] text-subtle">{children}</p>
    </div>
  );
}

export function AuthField({
  id,
  label,
  optional,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  help?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-label">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">(선택)</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : (
        help && (
          <p id={`${id}-help`} className="text-xs text-muted">
            {help}
          </p>
        )
      )}
    </div>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-[13px] text-danger">
      {children}
    </p>
  );
}

export function AuthFooter({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-[13px] text-muted">{children}</p>;
}

export const authLink = "font-semibold text-primary-ink hover:underline";
