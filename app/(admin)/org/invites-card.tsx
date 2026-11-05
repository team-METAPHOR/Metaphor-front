"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/badge";
import { api, type Schemas } from "@/lib/api";
import { role as roleLabel } from "@/lib/labels";
import { Card, CopyButton, ErrorText } from "../settings/ui";
import { useMembers } from "./members-card";
import {
  ConfirmDialog,
  buttonClass,
  dangerButtonClass,
  formatDateTime,
  inputClass,
  orgErrorMessage,
  orgKeys,
  roles,
} from "./ui";

type Invite = Schemas["InviteResponse"];
type InviteCreated = Schemas["InviteCreated"];
type Role = (typeof roles)[number];

const MIN_DAYS = 1;
const MAX_DAYS = 30;

/** 관리자 전용. 초대 코드 만들기, 대기 중인 초대 목록과 취소. */
export function InvitesCard({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const base = `/orgs/${encodeURIComponent(orgId)}/invites`;
  const invites = useQuery({ queryKey: orgKeys.invites(orgId), queryFn: () => api<Invite[]>(base) });
  const members = useMembers(orgId);

  const [role, setRole] = useState<Role>("developer");
  const [days, setDays] = useState("7");
  const [created, setCreated] = useState<InviteCreated | null>(null);
  const [revoking, setRevoking] = useState<Invite | null>(null);

  const dayCount = Number(days);
  const daysValid = Number.isInteger(dayCount) && dayCount >= MIN_DAYS && dayCount <= MAX_DAYS;

  const create = useMutation({
    mutationFn: () => api<InviteCreated>(base, { method: "POST", body: { role, expires_in_days: dayCount } }),
    onSuccess: (data) => {
      setCreated(data);
      queryClient.invalidateQueries({ queryKey: orgKeys.invites(orgId) });
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api<void>(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Invite[]>(orgKeys.invites(orgId), (list) => list?.filter((i) => i.id !== id));
      queryClient.invalidateQueries({ queryKey: orgKeys.invites(orgId) });
      setRevoking(null);
    },
  });

  function creatorName(userId: string): string {
    const member = members.data?.find((m) => m.user_id === userId);
    return member ? (member.display_name ?? member.email) : "알 수 없음";
  }

  return (
    <Card
      title="초대"
      description="초대 코드는 한 번만 쓸 수 있어요. 초대를 만든 관리자가 관리자 권한을 잃으면 그 초대는 쓸 수 없어요."
    >
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setCreated(null);
          create.mutate();
        }}
      >
        <div>
          <label htmlFor="invite-role" className="block text-xs text-muted">
            역할
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            className={`${inputClass} mt-1`}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r).label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="invite-days" className="block text-xs text-muted">
            유효 기간(일, {MIN_DAYS}~{MAX_DAYS})
          </label>
          <input
            id="invite-days"
            type="number"
            required
            min={MIN_DAYS}
            max={MAX_DAYS}
            step={1}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className={`${inputClass} mt-1 w-28`}
          />
        </div>
        <button type="submit" disabled={create.isPending || !daysValid} className={buttonClass}>
          {create.isPending ? "만드는 중…" : "초대 코드 만들기"}
        </button>
      </form>
      {create.isError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          초대를 만들지 못했어요. {orgErrorMessage(create.error)}
        </p>
      )}

      {created && (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning-soft p-4">
          <p className="text-sm font-medium text-warning-ink">
            {roleLabel(created.role).label} 초대 코드가 만들어졌어요. 이 코드는 지금 한 번만 보여요.
          </p>
          <p className="mt-1 text-xs text-warning-ink">
            창을 닫거나 새로고침하면 다시 볼 수 없어요. 받는 사람은 가입·로그인 후 &lsquo;시작하기&rsquo; 화면의
            &lsquo;초대 코드로 참여&rsquo;에 이 코드를 넣으면 돼요. {formatDateTime(created.expires_at)}까지 쓸 수 있어요.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm select-all">
              {created.token}
            </code>
            <CopyButton text={created.token} />
          </div>
          <div className="mt-3 text-right">
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="text-xs text-warning-ink underline-offset-2 hover:underline"
            >
              확인했어요, 닫기
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-border pt-4">
        <h3 className="text-sm font-medium">대기 중인 초대</h3>
        {invites.isPending && <p className="mt-2 text-sm text-muted">불러오는 중…</p>}
        {invites.isError && (
          <div className="mt-2">
            <ErrorText error={invites.error} what="초대 목록" />
          </div>
        )}
        {invites.data?.length === 0 && <p className="mt-2 text-sm text-muted">대기 중인 초대가 없어요.</p>}
        {invites.data && invites.data.length > 0 && (
          <ul className="mt-2 divide-y divide-border">
            {invites.data.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge>{roleLabel(invite.role).label}</Badge>
                  <span className="text-xs text-muted">만든 사람 {creatorName(invite.created_by)}</span>
                  <span className="text-xs text-muted">만료 {formatDateTime(invite.expires_at)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    revoke.reset();
                    setRevoking(invite);
                  }}
                  className={dangerButtonClass}
                >
                  취소
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={revoking != null}
        title="이 초대를 취소할까요?"
        description="취소한 초대 코드로는 더 참여할 수 없어요. 이미 참여한 멤버에게는 영향이 없어요."
        confirmLabel="초대 취소"
        pendingLabel="취소 중…"
        isPending={revoke.isPending}
        error={revoke.error}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
        onClose={() => setRevoking(null)}
      />
    </Card>
  );
}
