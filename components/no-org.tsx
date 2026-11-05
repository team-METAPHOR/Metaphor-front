"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api, type Schemas } from "@/lib/api";
import { homePath, meQueryKey, useLogout } from "@/lib/auth";

type Joined = { role: string };

const inputClass =
  "min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary";
const buttonClass =
  "shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60";

function joinErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "INVITE_INVALID") return "유효하지 않거나 만료된 초대 코드예요.";
    if (error.code === "ALREADY_MEMBER") return "이미 이 조직의 멤버예요.";
    if (error.status === 429) return "시도가 너무 많아요. 잠시 후 다시 시도하세요.";
    if (error.status === 422) return "입력값을 확인하세요.";
    return error.message;
  }
  return "요청하지 못했어요. 잠시 후 다시 시도하세요.";
}

/** 조직에 속하지 않은 사용자의 첫 화면. 조직을 새로 만들거나 초대 코드로 참여한다. */
export function NoOrgScreen({ user }: { user: Schemas["MeResponse"] }) {
  const router = useRouter();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [orgName, setOrgName] = useState("");
  const [token, setToken] = useState("");

  async function enter({ role }: Joined) {
    // 새 소속이 담긴 me를 받아야 AuthGate가 화면을 연다.
    await queryClient.refetchQueries({ queryKey: meQueryKey, exact: true });
    router.replace(homePath(role));
  }

  const createOrg = useMutation({
    mutationFn: () =>
      api<Schemas["OrgResponse"]>("/orgs", { method: "POST", body: { name: orgName.trim() }, idempotent: true }),
    onSuccess: enter,
  });
  const accept = useMutation({
    mutationFn: () => api<Schemas["InviteAccepted"]>("/invites/accept", { method: "POST", body: { token: token.trim() } }),
    onSuccess: enter,
  });
  const busy = createOrg.isPending || accept.isPending;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-bold">시작하기</h1>
        <p className="mt-1 text-sm text-muted">
          {user.display_name ?? user.email}님, 아직 소속된 조직이 없어요. 조직을 만들거나 초대 코드로 참여하세요.
        </p>

        <form
          className="mt-8"
          onSubmit={(event) => {
            event.preventDefault();
            createOrg.mutate();
          }}
        >
          <label htmlFor="org-name" className="block text-sm font-medium">
            새 조직 만들기
          </label>
          <p className="text-xs text-muted">만든 사람이 관리자가 돼요.</p>
          <div className="mt-2 flex gap-2">
            <input
              id="org-name"
              required
              maxLength={200}
              placeholder="회사 또는 팀 이름"
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
              className={inputClass}
            />
            <button type="submit" disabled={busy || orgName.trim() === ""} className={buttonClass}>
              {createOrg.isPending ? "만드는 중…" : "만들기"}
            </button>
          </div>
          {createOrg.isError && (
            <p role="alert" className="mt-1.5 text-sm text-red-600">
              {joinErrorMessage(createOrg.error)}
            </p>
          )}
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          또는
          <span className="h-px flex-1 bg-border" />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            accept.mutate();
          }}
        >
          <label htmlFor="invite-token" className="block text-sm font-medium">
            초대 코드로 참여
          </label>
          <p className="text-xs text-muted">조직 관리자에게 받은 초대 코드를 넣으세요.</p>
          <div className="mt-2 flex gap-2">
            <input
              id="invite-token"
              required
              maxLength={200}
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className={`${inputClass} font-mono`}
            />
            <button type="submit" disabled={busy || token.trim() === ""} className={buttonClass}>
              {accept.isPending ? "참여 중…" : "참여"}
            </button>
          </div>
          {accept.isError && (
            <p role="alert" className="mt-1.5 text-sm text-red-600">
              {joinErrorMessage(accept.error)}
            </p>
          )}
        </form>

        <div className="mt-8 border-t border-border pt-4 text-right">
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="text-sm text-muted hover:text-foreground disabled:opacity-60"
          >
            {logout.isPending ? "로그아웃 중…" : "로그아웃"}
          </button>
        </div>
      </div>
    </main>
  );
}
