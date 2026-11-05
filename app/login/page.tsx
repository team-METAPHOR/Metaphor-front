"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ApiError, api, type Schemas } from "@/lib/api";
import { homePath, meQueryKey, useMe } from "@/lib/auth";
import { AuthError, AuthField, AuthFooter, AuthHeading, AuthShell, authInput, authLink, authSubmit } from "@/components/auth-ui";

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
    <AuthShell>
      <AuthHeading title="로그인">버그 신고를 관리하려면 로그인하세요.</AuthHeading>

      {/* useSearchParams는 Suspense 안에서만 쓸 수 있다(cacheComponents). */}
      <Suspense fallback={null}>
        <PasswordChangedNotice />
      </Suspense>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate();
        }}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-4">
          <AuthField id="email" label="이메일">
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              maxLength={320}
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={authInput}
            />
          </AuthField>
          <AuthField id="password" label="비밀번호">
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={login.isError}
              className={authInput}
            />
          </AuthField>
          {login.isError && <AuthError>{loginErrorMessage(login.error)}</AuthError>}
        </div>

        <button type="submit" disabled={login.isPending} className={authSubmit}>
          {login.isPending ? "로그인 중…" : "로그인"}
        </button>
      </form>

      <AuthFooter>
        계정이 없나요?{" "}
        <Link href="/signup" className={authLink}>
          회원가입
        </Link>
      </AuthFooter>
    </AuthShell>
  );
}

/** 비밀번호 변경 뒤 모든 세션이 끊겨 이 화면으로 온 경우(/login?changed=1) 안내한다. */
function PasswordChangedNotice() {
  if (useSearchParams().get("changed") !== "1") return null;
  return (
    <p role="status" className="rounded-lg bg-primary-soft px-3.5 py-2.5 text-[13px] font-medium text-primary-ink">
      비밀번호가 바뀌었어요. 새 비밀번호로 다시 로그인하세요.
    </p>
  );
}
