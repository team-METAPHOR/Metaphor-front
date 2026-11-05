"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/badge";
import { api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { role as roleLabel } from "@/lib/labels";
import { OriginVerificationCard } from "./origin-verification-card";
import { CreateProgramCard, ProgramCard } from "./program-cards";
import { Card, ErrorText, widgetSettingsKey } from "./ui";
import { SdkSnippet } from "./sdk-snippet";
import { WidgetSettingsCard } from "./widget-settings-card";

type Program = Schemas["ProgramResponse"];
type ProgramList = Schemas["ProgramList"];
type WidgetSettings = Schemas["WidgetSettingsResponse"];

export function SettingsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin } = useSession();
  const programs = useQuery({ queryKey: ["programs"], queryFn: () => api<ProgramList>("/programs") });
  const [creating, setCreating] = useState(false);
  // 방금 등록한 사이트. 도메인 소유 확인 안내를 띄운다.
  const [createdId, setCreatedId] = useState<string | null>(null);

  function select(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("program", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function created(program: Program) {
    setCreating(false);
    setCreatedId(program.id);
    select(program.id);
  }

  if (programs.isPending) return <p className="text-sm text-muted">사이트 목록을 불러오는 중…</p>;
  if (programs.isError) return <ErrorText error={programs.error} what="사이트 목록" />;

  const items = programs.data.items;
  if (items.length === 0) {
    if (isAdmin) return <CreateProgramCard onCreated={created} />;
    return (
      <Card>
        <p className="text-sm text-muted">등록된 사이트가 없어요. 관리자에게 사이트 등록을 요청하세요.</p>
      </Card>
    );
  }

  const requested = searchParams.get("program");
  const selected = items.find((item) => item.id === requested) ?? items[0];

  return (
    <div className="space-y-6">
      <Card>
        <label htmlFor="program-select" className="block text-sm font-medium">
          사이트
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            id="program-select"
            value={selected.id}
            onChange={(event) => {
              setCreating(false);
              select(event.target.value);
            }}
            className="min-w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted">{selected.base_url}</span>
          <Badge>{roleLabel(selected.role).label}</Badge>
          {isAdmin && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="ml-auto rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-background"
            >
              사이트 추가
            </button>
          )}
        </div>
      </Card>

      {creating ? (
        <CreateProgramCard onCreated={created} onCancel={() => setCreating(false)} />
      ) : (
        <>
          {createdId === selected.id && (
            <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
              사이트를 등록했어요. 아래 <strong>도메인 소유 확인</strong>을 마쳐야 위젯 신고와 AI 재현 검증이 시작돼요.
            </p>
          )}
          <ProgramDetail key={selected.id} programId={selected.id} />
        </>
      )}
    </div>
  );
}

function ProgramDetail({ programId }: { programId: string }) {
  const { isAdmin } = useSession();
  const program = useQuery({
    queryKey: ["programs", programId],
    queryFn: () => api<Program>(`/programs/${encodeURIComponent(programId)}`),
  });
  const settings = useQuery({
    queryKey: widgetSettingsKey(programId),
    queryFn: () => api<WidgetSettings>(`/programs/${encodeURIComponent(programId)}/widget-settings`),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <ProgramCard query={program} />
        <OriginVerificationCard programId={programId} isAdmin={isAdmin} />
        {settings.isPending && (
          <Card>
            <p className="text-sm text-muted">위젯 설정을 불러오는 중…</p>
          </Card>
        )}
        {settings.isError && (
          <Card>
            <ErrorText error={settings.error} what="위젯 설정" />
          </Card>
        )}
        {settings.data && <SdkSnippet programId={programId} settings={settings.data} isAdmin={isAdmin} />}
      </div>
      {settings.data && (
        <WidgetSettingsCard
          // 서버 값이 바뀌면 편집 중인 초안을 새 값으로 다시 시작한다.
          key={settings.data.updated_at ?? "never"}
          programId={programId}
          settings={settings.data}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
