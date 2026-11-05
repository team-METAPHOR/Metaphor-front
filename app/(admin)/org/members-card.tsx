"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/badge";
import { api, type Schemas } from "@/lib/api";
import { meQueryKey, useSession } from "@/lib/auth";
import { role as roleLabel } from "@/lib/labels";
import { Card, ErrorText } from "../settings/ui";
import {
  ConfirmDialog,
  dangerButtonClass,
  formatDateTime,
  inputClass,
  orgErrorMessage,
  orgKeys,
  roles,
} from "./ui";

type Member = Schemas["MemberResponse"];
type Role = (typeof roles)[number];

type Pending =
  | { kind: "remove"; member: Member }
  | { kind: "leave" }
  | { kind: "demote-self"; role: Role };

export function useMembers(orgId: string) {
  return useQuery({
    queryKey: orgKeys.members(orgId),
    queryFn: () => api<Member[]>(`/orgs/${encodeURIComponent(orgId)}/members`),
  });
}

export function MembersCard({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const members = useMembers(orgId);
  const [pending, setPending] = useState<Pending | null>(null);
  const memberPath = (userId: string) => `/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`;

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      api<Member>(memberPath(userId), { method: "PATCH", body: { role } }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Member[]>(orgKeys.members(orgId), (list) =>
        list?.map((m) => (m.user_id === updated.user_id ? updated : m)),
      );
      // 내 역할이 바뀌면 화면 권한(isAdmin)도 다시 계산해야 한다.
      if (updated.user_id === user.id) queryClient.invalidateQueries({ queryKey: meQueryKey, exact: true });
      setPending(null);
    },
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api<void>(memberPath(userId), { method: "DELETE" }),
    onSuccess: (_, userId) => {
      if (userId === user.id) {
        // 나가면 서버가 내 세션을 모두 지운다. 이전 조직의 캐시를 버리고 me를 처음부터 다시 받는다.
        // me가 401이면 AuthGate가 로그인 화면으로, 소속이 없으면 시작하기 화면으로 보낸다.
        queryClient.removeQueries({ predicate: (query) => query.queryKey.join("/") !== meQueryKey.join("/") });
        queryClient.resetQueries({ queryKey: meQueryKey, exact: true });
        return;
      }
      queryClient.invalidateQueries({ queryKey: orgKeys.members(orgId) });
      queryClient.invalidateQueries({ queryKey: orgKeys.detail(orgId), exact: true });
      setPending(null);
    },
  });

  function open(next: Pending) {
    changeRole.reset();
    remove.reset();
    setPending(next);
  }

  function selectRole(member: Member, role: Role) {
    if (member.user_id === user.id && role !== "admin") {
      open({ kind: "demote-self", role });
      return;
    }
    remove.reset();
    changeRole.mutate({ userId: member.user_id, role });
  }

  const dialog = (() => {
    if (pending?.kind === "remove") {
      const name = pending.member.display_name ?? pending.member.email;
      return {
        title: `${name}님을 조직에서 내보낼까요?`,
        description:
          "내보낸 멤버는 바로 모든 기기에서 로그아웃되고 이 조직의 신고와 설정을 볼 수 없어요. 다시 들어오려면 새 초대 코드가 필요해요.",
        confirmLabel: "내보내기",
        pendingLabel: "내보내는 중…",
        isPending: remove.isPending,
        error: remove.error,
        onConfirm: () => remove.mutate(pending.member.user_id),
      };
    }
    if (pending?.kind === "leave") {
      return {
        title: "조직에서 나갈까요?",
        description:
          "나가면 바로 모든 기기에서 로그아웃되고 이 조직의 신고와 설정을 볼 수 없어요. 다시 들어오려면 관리자에게 새 초대 코드를 받아야 해요.",
        confirmLabel: "나가기",
        pendingLabel: "나가는 중…",
        isPending: remove.isPending,
        error: remove.error,
        onConfirm: () => remove.mutate(user.id),
      };
    }
    if (pending?.kind === "demote-self") {
      return {
        title: `내 역할을 ${roleLabel(pending.role).label}(으)로 바꿀까요?`,
        description: "관리자 권한을 잃어서 조직 이름, 멤버, 초대를 더 관리할 수 없어요. 다른 관리자만 되돌릴 수 있어요.",
        confirmLabel: "역할 변경",
        pendingLabel: "변경 중…",
        isPending: changeRole.isPending,
        error: changeRole.error,
        onConfirm: () => changeRole.mutate({ userId: user.id, role: pending.role }),
      };
    }
    return null;
  })();

  return (
    <Card
      title="멤버"
      description={isAdmin ? "비활성 멤버는 관리자에게만 보여요." : "멤버 관리는 관리자만 할 수 있어요."}
    >
      {members.isPending && <p className="text-sm text-muted">불러오는 중…</p>}
      {members.isError && <ErrorText error={members.error} what="멤버 목록" />}
      {members.data && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-2 pr-4 font-medium">멤버</th>
                <th className="py-2 pr-4 font-medium">역할</th>
                <th className="py-2 pr-4 font-medium">참여일</th>
                {isAdmin && <th className="py-2 font-medium" aria-label="작업" />}
              </tr>
            </thead>
            <tbody>
              {members.data.map((member) => {
                const isSelf = member.user_id === user.id;
                const editable = isAdmin && member.is_active;
                return (
                  <tr key={member.user_id} className={`border-b border-border last:border-0 ${member.is_active ? "" : "text-muted"}`}>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{member.display_name ?? member.email}</span>
                        {isSelf && <Badge tone="info">나</Badge>}
                        {!member.is_active && <Badge>비활성</Badge>}
                      </div>
                      {member.display_name && <p className="text-xs text-muted">{member.email}</p>}
                    </td>
                    <td className="py-3 pr-4">
                      {editable ? (
                        <select
                          aria-label={`${member.display_name ?? member.email} 역할`}
                          value={member.role}
                          disabled={changeRole.isPending}
                          onChange={(event) => selectRole(member, event.target.value as Role)}
                          className={`${inputClass} py-1.5`}
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r).label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge>{roleLabel(member.role).label}</Badge>
                      )}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-xs">{formatDateTime(member.joined_at)}</td>
                    {isAdmin && (
                      <td className="py-3 text-right">
                        {editable && !isSelf && (
                          <button type="button" onClick={() => open({ kind: "remove", member })} className={dangerButtonClass}>
                            내보내기
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {changeRole.isError && pending == null && (
        <p role="alert" className="mt-3 text-sm text-danger">
          역할을 바꾸지 못했어요. {orgErrorMessage(changeRole.error)}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">조직 나가기</p>
          <p className="text-xs text-muted">
            {isAdmin ? "마지막 관리자는 다른 멤버를 관리자로 지정한 뒤에 나갈 수 있어요." : "나가면 이 조직의 신고를 더 볼 수 없어요."}
          </p>
        </div>
        <button type="button" onClick={() => open({ kind: "leave" })} className={dangerButtonClass}>
          나가기
        </button>
      </div>

      <ConfirmDialog
        open={dialog != null}
        title={dialog?.title ?? ""}
        description={dialog?.description ?? ""}
        confirmLabel={dialog?.confirmLabel ?? ""}
        pendingLabel={dialog?.pendingLabel ?? ""}
        isPending={dialog?.isPending ?? false}
        error={dialog?.error ?? null}
        onConfirm={() => dialog?.onConfirm()}
        onClose={() => setPending(null)}
      />
    </Card>
  );
}
