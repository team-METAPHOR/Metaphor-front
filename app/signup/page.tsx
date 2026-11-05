"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api, type Schemas } from "@/lib/api";
import { homePath, meQueryKey, useMe } from "@/lib/auth";

type Me = Schemas["MeResponse"];

const MIN_PASSWORD = 10;

function signupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "EMAIL_TAKEN") return "이미 가입된 이메일이에요. 로그인하세요.";
    if (error.status === 429) return "가입 시도가 너무 많아요. 잠시 후 다시 시도하세요.";
    if (error.status === 422) return "입력값을 확인하세요.";
    if (error.code === "CSRF_REJECTED") return "허용되지 않은 주소에서 접속했어요. 관리자에게 문의하세요.";
  }
  return "가입하지 못했어요. 잠시 후 다시 시도하세요.";
}

const inputClass =
  "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary";

export default function SignupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm !== "" && password !== confirm;

  // 이미 로그인돼 있으면 첫 화면으로 보낸다.
  const signedIn = me.isSuccess;
  const signedInRole = me.data?.memberships[0]?.role ?? "";
  useEffect(() => {
    if (signedIn) router.replace(homePath(signedInRole));
  }, [signedIn, signedInRole, router]);

  const signup = useMutation({
    mutationFn: async () => {
      await api("/auth/signup", {
        method: "POST",
        body: { email, password, display_name: displayName.trim() || null },
      });
      // 가입 응답에는 세션이 없어서 바로 로그인한다.
      await api("/auth/login", { method: "POST", body: { email, password } });
      return api<Me>("/auth/me");
    },
    onSuccess: (user) => {
      // 새 사용자는 조직이 없으므로 첫 화면에서 조직 만들기/초대 수락 안내가 나온다.
      queryClient.setQueryData(meQueryKey, user);
      router.replace(homePath(user.memberships[0]?.role ?? ""));
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!mismatch) signup.mutate();
        }}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold">회원가입</h1>
        <p className="mt-1 text-sm text-muted">Metaphor 버그 신고 관리</p>

        <label className="mt-8 block text-sm font-medium" htmlFor="email">
          이메일
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          maxLength={320}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="display-name">
          이름 <span className="font-normal text-muted">(선택)</span>
        </label>
        <input
          id="display-name"
          type="text"
          autoComplete="name"
          maxLength={100}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className={inputClass}
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="password">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          maxLength={256}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="password-help"
          className={inputClass}
        />
        <p id="password-help" className="mt-1 text-xs text-muted">
          {MIN_PASSWORD}자 이상
        </p>

        <label className="mt-4 block text-sm font-medium" htmlFor="password-confirm">
          비밀번호 확인
        </label>
        <input
          id="password-confirm"
          type="password"
          autoComplete="new-password"
          required
          maxLength={256}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={mismatch}
          className={`${inputClass} aria-invalid:border-red-400`}
        />
        {mismatch && <p className="mt-1 text-xs text-red-600">비밀번호가 서로 달라요.</p>}

        {signup.isError && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {signupErrorMessage(signup.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={signup.isPending || mismatch}
          className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {signup.isPending ? "가입 중…" : "가입하기"}
        </button>

        <p className="mt-4 text-center text-sm text-muted">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            로그인
          </Link>
        </p>
      </form>
    </main>
  );
}
