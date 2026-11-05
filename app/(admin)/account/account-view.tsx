"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/auth";
import * as labels from "@/lib/labels";

const MIN_PASSWORD = 10;
const MAX_PASSWORD = 256;

function changeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_CREDENTIALS") return "현재 비밀번호가 맞지 않아요.";
    if (error.code === "PASSWORD_CHANGE_THROTTLED" || error.status === 429)
      return "비밀번호 변경 시도가 너무 많아요. 잠시 후(최대 1시간) 다시 시도하세요.";
    if (error.status === 422)
      return `입력값을 확인하세요. 새 비밀번호는 ${MIN_PASSWORD}자 이상 ${MAX_PASSWORD}자 이하여야 해요.`;
    if (error.code === "CSRF_REJECTED") return "허용되지 않은 주소에서 접속했어요. 관리자에게 문의하세요.";
    // INVALID_CREDENTIALS 외의 401은 세션이 끊긴 것이다. Providers가 로그인 화면으로 보낸다.
    if (error.status === 401) return "로그인이 만료됐어요. 다시 로그인하세요.";
  }
  return "비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도하세요.";
}

const inputClass =
  "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary";

export function AccountView() {
  return (
    <>
      <AccountInfo />
      <PasswordForm />
    </>
  );
}

function AccountInfo() {
  const { user, membership } = useSession();
  const rows: [string, string][] = [
    ["이메일", user.email],
    ["이름", user.display_name ?? "-"],
    ["조직", membership.org_name],
    ["역할", labels.role(membership.role).label],
  ];
  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold">계정 정보</h2>
      <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted">{term}</dt>
            <dd className="break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PasswordForm() {
  const { user } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm !== "" && next !== confirm;

  const change = useMutation({
    mutationFn: () =>
      api<void>("/auth/password", {
        method: "POST",
        body: { current_password: current, new_password: next },
      }),
    onSuccess: () => {
      // 서버가 이 세션을 포함한 모든 세션을 끊고 쿠키도 지운다.
      // 전체 페이지 이동으로 쿼리 캐시를 비우고 로그인 화면에서 안내를 띄운다.
      // (router.replace를 쓰면 캐시를 비운 순간 AuthGate가 /login 으로 먼저 보낼 수 있다.)
      window.location.replace("/login?changed=1");
    },
  });

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold">비밀번호 변경</h2>
      <p className="mt-1 text-sm text-muted">바꾸면 모든 기기에서 로그아웃되고 다시 로그인해야 해요.</p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!mismatch) change.mutate();
        }}
      >
        {/* 비밀번호 관리자가 어느 계정의 비밀번호인지 알 수 있게 한다. */}
        <input type="text" autoComplete="username" value={user.email} readOnly hidden />

        <label className="mt-6 block text-sm font-medium" htmlFor="current-password">
          현재 비밀번호
        </label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={MAX_PASSWORD}
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          className={inputClass}
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="new-password">
          새 비밀번호
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          maxLength={MAX_PASSWORD}
          value={next}
          onChange={(event) => setNext(event.target.value)}
          aria-describedby="new-password-help"
          className={inputClass}
        />
        <p id="new-password-help" className="mt-1 text-xs text-muted">
          {MIN_PASSWORD}자 이상
        </p>

        <label className="mt-4 block text-sm font-medium" htmlFor="new-password-confirm">
          새 비밀번호 확인
        </label>
        <input
          id="new-password-confirm"
          type="password"
          autoComplete="new-password"
          required
          maxLength={MAX_PASSWORD}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={mismatch}
          className={`${inputClass} aria-invalid:border-red-400`}
        />
        {mismatch && <p className="mt-1 text-xs text-danger">새 비밀번호가 서로 달라요.</p>}

        {change.isError && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {changeErrorMessage(change.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={change.isPending || change.isSuccess || mismatch}
          className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {change.isPending ? "바꾸는 중…" : change.isSuccess ? "로그인 화면으로 이동 중…" : "비밀번호 변경"}
        </button>
      </form>
    </section>
  );
}
