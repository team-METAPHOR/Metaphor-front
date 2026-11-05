"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect } from "react";
import { NoOrgScreen } from "@/components/no-org";
import { api, isUnauthenticated, type Schemas } from "@/lib/api";
import type { Role } from "@/types/report";

type Me = Schemas["MeResponse"];
type Membership = Schemas["MembershipResponse"];

export const meQueryKey = ["auth", "me"] as const;

export function useMe() {
  return useQuery({ queryKey: meQueryKey, queryFn: () => api<Me>("/auth/me"), retry: false });
}

/** 역할별 첫 화면. developer는 신고를 바로 보는 일이 많아 목록으로 보낸다. */
export function homePath(role: string): string {
  return role === "developer" ? "/reports" : "/dashboard";
}

type Session = {
  user: Me;
  /** 현재 조직. 여러 조직에 속하면 첫 번째를 쓴다. */
  membership: Membership;
  role: Role | string;
  /** 재검증 요청, AI 질문 답변, job 취소 */
  canReview: boolean;
  /** 사이트·위젯 설정 변경, 키 재발급 */
  isAdmin: boolean;
};

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession은 AuthGate 안에서만 쓸 수 있다.");
  return session;
}

/** 로그인과 조직 소속을 확인한 뒤에만 children을 그린다. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, error, isPending } = useMe();
  const unauthenticated = isUnauthenticated(error);

  useEffect(() => {
    if (unauthenticated) router.replace("/login");
  }, [unauthenticated, router]);

  if (isPending || unauthenticated) return <p className="text-sm text-muted">불러오는 중…</p>;
  if (error) return <p className="text-sm text-danger">사용자 정보를 불러오지 못했어요. ({error.message})</p>;

  const membership = user.memberships[0];
  if (!membership) {
    return <NoOrgScreen user={user} />;
  }

  const role = membership.role;
  const session: Session = {
    user,
    membership,
    role,
    canReview: role === "developer" || role === "admin",
    isAdmin: role === "admin",
  };
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });
}
