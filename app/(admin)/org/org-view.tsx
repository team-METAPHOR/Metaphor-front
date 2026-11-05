"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/badge";
import { api, type Schemas } from "@/lib/api";
import { meQueryKey, useSession } from "@/lib/auth";
import { role as roleLabel } from "@/lib/labels";
import { Card, ErrorText } from "../settings/ui";
import { InvitesCard } from "./invites-card";
import { MembersCard } from "./members-card";
import { buttonClass, formatDateTime, inputClass, orgErrorMessage, orgKeys, secondaryButtonClass } from "./ui";

type OrgDetail = Schemas["OrgDetail"];

export function OrgView() {
  const { membership, isAdmin } = useSession();
  const orgId = membership.org_id;

  return (
    <div className="space-y-6">
      <OrgInfoCard orgId={orgId} isAdmin={isAdmin} />
      <MembersCard orgId={orgId} isAdmin={isAdmin} />
      {isAdmin && <InvitesCard orgId={orgId} />}
    </div>
  );
}

function OrgInfoCard({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const org = useQuery({
    queryKey: orgKeys.detail(orgId),
    queryFn: () => api<OrgDetail>(`/orgs/${encodeURIComponent(orgId)}`),
  });
  const [editing, setEditing] = useState(false);

  if (org.isPending) {
    return (
      <Card title="조직 정보">
        <p className="text-sm text-muted">불러오는 중…</p>
      </Card>
    );
  }
  if (org.isError) {
    return (
      <Card title="조직 정보">
        <ErrorText error={org.error} what="조직 정보" />
      </Card>
    );
  }

  const data = org.data;
  return (
    <Card
      title="조직 정보"
      action={
        isAdmin && !editing ? (
          <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClass}>
            이름 변경
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <RenameForm orgId={orgId} current={data.name} onDone={() => setEditing(false)} />
      ) : (
        <dl className="grid gap-4 text-sm sm:grid-cols-4">
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">이름</dt>
            <dd className="mt-0.5 font-medium">{data.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">활성 멤버</dt>
            <dd className="mt-0.5">{data.member_count.toLocaleString("ko-KR")}명</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">내 역할</dt>
            <dd className="mt-0.5">
              <Badge>{roleLabel(data.role).label}</Badge>
            </dd>
          </div>
          <div className="sm:col-span-4">
            <dt className="text-xs text-muted">만든 날</dt>
            <dd className="mt-0.5">{formatDateTime(data.created_at)}</dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

function RenameForm({ orgId, current, onDone }: { orgId: string; current: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(current);
  const trimmed = name.trim();

  const rename = useMutation({
    mutationFn: () =>
      api<OrgDetail>(`/orgs/${encodeURIComponent(orgId)}`, { method: "PATCH", body: { name: trimmed } }),
    onSuccess: (data) => {
      queryClient.setQueryData(orgKeys.detail(orgId), data);
      // 사이드바 사용자 메뉴의 조직 이름은 me 응답에서 온다.
      queryClient.invalidateQueries({ queryKey: meQueryKey, exact: true });
      onDone();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        rename.mutate();
      }}
    >
      <label htmlFor="org-rename" className="block text-sm font-medium">
        조직 이름
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="org-rename"
          required
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button type="submit" disabled={rename.isPending || trimmed === "" || trimmed === current} className={buttonClass}>
          {rename.isPending ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm hover:bg-background"
        >
          취소
        </button>
      </div>
      {rename.isError && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          이름을 바꾸지 못했어요. {orgErrorMessage(rename.error)}
        </p>
      )}
    </form>
  );
}
