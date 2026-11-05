"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api, type Schemas } from "@/lib/api";
import { AuthError, AuthHeading, AuthShell, authInput } from "@/components/auth-ui";
import { homePath, meQueryKey, useLogout } from "@/lib/auth";

type Joined = { role: string };

const joinButton =
  "shrink-0 rounded-lg bg-primary px-4 py-[11px] text-[15px] font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";

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
    <AuthShell wide>
      <AuthHeading title="시작하기">
        {user.display_name ?? user.email}님, 아직 소속된 조직이 없어요.
        <br />
        조직을 만들거나 초대 코드로 참여하세요.
      </AuthHeading>

      <JoinBlock
        id="org-name"
        title="새 조직 만들기"
        help="만든 사람이 관리자가 돼요."
        placeholder="회사 또는 팀 이름"
        value={orgName}
        onChange={setOrgName}
        submitLabel={createOrg.isPending ? "만드는 중…" : "만들기"}
        disabled={busy || orgName.trim() === ""}
        onSubmit={() => createOrg.mutate()}
        error={createOrg.isError ? joinErrorMessage(createOrg.error) : null}
      />

      <div className="flex items-center gap-3 text-xs font-medium text-faint">
        <span className="h-px flex-1 bg-border" />
        또는
        <span className="h-px flex-1 bg-border" />
      </div>

      <JoinBlock
        id="invite-token"
        title="초대 코드로 참여"
        help="조직 관리자에게 받은 초대 코드를 넣으세요."
        placeholder="초대 코드"
        mono
        value={token}
        onChange={setToken}
        submitLabel={accept.isPending ? "참여 중…" : "참여"}
        disabled={busy || token.trim() === ""}
        onSubmit={() => accept.mutate()}
        error={accept.isError ? joinErrorMessage(accept.error) : null}
      />

      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="self-center text-[13px] font-medium text-muted hover:text-foreground disabled:opacity-60"
      >
        {logout.isPending ? "로그아웃 중…" : "로그아웃"}
      </button>
    </AuthShell>
  );
}

function JoinBlock({
  id,
  title,
  help,
  placeholder,
  mono,
  value,
  onChange,
  submitLabel,
  disabled,
  onSubmit,
  error,
}: {
  id: string;
  title: string;
  help: string;
  placeholder: string;
  mono?: boolean;
  value: string;
  onChange: (value: string) => void;
  submitLabel: string;
  disabled: boolean;
  onSubmit: () => void;
  error: string | null;
}) {
  return (
    <form
      className="flex flex-col gap-2.5 rounded-lg bg-surface-inset p-[18px]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor={id} className="text-[15px] font-semibold">
        {title}
      </label>
      <p className="text-[13px] text-subtle">{help}</p>
      <div className="flex gap-2">
        <input
          id={id}
          required
          maxLength={200}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error != null}
          className={`${authInput} min-w-0 flex-1 ${mono ? "font-mono" : ""}`}
        />
        <button type="submit" disabled={disabled} className={joinButton}>
          {submitLabel}
        </button>
      </div>
      {error && <AuthError>{error}</AuthError>}
    </form>
  );
}
