"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api, type Schemas } from "@/lib/api";
import { homePath, meQueryKey, useMe } from "@/lib/auth";
import { AuthError, AuthField, AuthFooter, AuthHeading, AuthShell, authInput, authLink, authSubmit } from "@/components/auth-ui";

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
    <AuthShell>
      <AuthHeading title="회원가입">가입한 뒤 조직을 만들거나 초대 코드로 참여해요.</AuthHeading>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!mismatch) signup.mutate();
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
          <AuthField id="display-name" label="이름" optional>
            <input
              id="display-name"
              type="text"
              autoComplete="name"
              maxLength={100}
              placeholder="팀에서 보일 이름"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={authInput}
            />
          </AuthField>
          <AuthField id="password" label="비밀번호" help={`${MIN_PASSWORD}자 이상`}>
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
              className={authInput}
            />
          </AuthField>
          <AuthField id="password-confirm" label="비밀번호 확인" error={mismatch && "비밀번호가 서로 달라요."}>
            <input
              id="password-confirm"
              type="password"
              autoComplete="new-password"
              required
              maxLength={256}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              aria-invalid={mismatch}
              className={authInput}
            />
          </AuthField>
          {signup.isError && <AuthError>{signupErrorMessage(signup.error)}</AuthError>}
        </div>

        <button type="submit" disabled={signup.isPending || mismatch} className={authSubmit}>
          {signup.isPending ? "가입 중…" : "가입하기"}
        </button>
      </form>

      <AuthFooter>
        이미 계정이 있나요?{" "}
        <Link href="/login" className={authLink}>
          로그인
        </Link>
      </AuthFooter>
    </AuthShell>
  );
}
