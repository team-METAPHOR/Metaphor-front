"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ApiError, api, type Schemas } from "@/lib/api";
import { homePath, meQueryKey, useMe } from "@/lib/auth";

type Me = Schemas["MeResponse"];

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_CREDENTIALS") return "이메일 또는 비밀번호가 맞지 않아요.";
    if (error.status === 429) return "시도가 너무 많아요. 잠시 후 다시 시도하세요.";
    if (error.status === 422) return "입력값을 확인하세요.";
    if (error.code === "CSRF_REJECTED") return "허용되지 않은 주소에서 접속했어요. 관리자에게 문의하세요.";
  }
  return "로그인하지 못했어요. 잠시 후 다시 시도하세요.";
}

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 이미 로그인돼 있으면 첫 화면으로 보낸다.
  // 조직이 없는 사용자도 첫 화면의 조직 만들기/초대 수락 안내로 보낸다.
  const signedIn = me.isSuccess;
  const signedInRole = me.data?.memberships[0]?.role ?? "";
  useEffect(() => {
    if (signedIn) router.replace(homePath(signedInRole));
  }, [signedIn, signedInRole, router]);

  const login = useMutation({
    mutationFn: async () => {
      await api("/auth/login", { method: "POST", body: { email, password } });
      return api<Me>("/auth/me");
    },
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryKey, user);
      router.replace(homePath(user.memberships[0]?.role ?? ""));
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate();
        }}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold">Metaphor</h1>
        <p className="mt-1 text-sm text-muted">버그 신고 관리</p>

        {/* useSearchParams는 Suspense 안에서만 쓸 수 있다(cacheComponents). */}
        <Suspense fallback={null}>
          <PasswordChangedNotice />
        </Suspense>

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
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="password">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />

        {login.isError && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {loginErrorMessage(login.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {login.isPending ? "로그인 중…" : "로그인"}
        </button>

        <p className="mt-4 text-center text-sm text-muted">
          계정이 없나요?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            회원가입
          </Link>
        </p>
      </form>
    </main>
  );
}

/** 비밀번호 변경 뒤 모든 세션이 끊겨 이 화면으로 온 경우(/login?changed=1) 안내한다. */
function PasswordChangedNotice() {
  if (useSearchParams().get("changed") !== "1") return null;
  return (
    <p role="status" className="mt-6 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
      비밀번호가 바뀌었어요. 새 비밀번호로 다시 로그인하세요.
    </p>
  );
}
