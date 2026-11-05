"use client";

import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/badge";
import { api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { role as roleLabel } from "@/lib/labels";
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
  const programs = useQuery({ queryKey: ["programs"], queryFn: () => api<ProgramList>("/programs") });

  if (programs.isPending) return <p className="text-sm text-muted">사이트 목록을 불러오는 중…</p>;
  if (programs.isError) return <ErrorText error={programs.error} what="사이트 목록" />;

  const items = programs.data.items;
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">등록된 사이트가 없어요.</p>
      </Card>
    );
  }

  const requested = searchParams.get("program");
  const selected = items.find((item) => item.id === requested) ?? items[0];

  function select(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("program", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

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
            onChange={(event) => select(event.target.value)}
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
        </div>
      </Card>

      <ProgramDetail key={selected.id} programId={selected.id} />
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
        <ProgramInfo query={program} />
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

function ProgramInfo({ query }: { query: UseQueryResult<Program> }) {
  if (query.isPending) {
    return (
      <Card title="사이트 정보">
        <p className="text-sm text-muted">불러오는 중…</p>
      </Card>
    );
  }
  if (query.isError) {
    return (
      <Card title="사이트 정보">
        <ErrorText error={query.error} what="사이트 정보" />
      </Card>
    );
  }

  const program = query.data;
  const { scope } = program;
  return (
    <Card title="사이트 정보" description="읽기 전용이에요.">
      <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
        <dt className="text-muted">이름</dt>
        <dd className="font-medium">{program.name}</dd>
        <dt className="text-muted">상태</dt>
        <dd>
          <Badge tone={program.status === "active" ? "success" : "neutral"}>{programStatusLabel(program.status)}</Badge>
        </dd>
        <dt className="text-muted">기본 URL</dt>
        <dd className="break-all font-mono text-xs leading-5">{scope.base_url}</dd>
        <dt className="text-muted">허용 경로</dt>
        <dd>
          <PathList paths={scope.allowed_path_prefixes} empty="전체" />
        </dd>
        <dt className="text-muted">제외 경로</dt>
        <dd>
          <PathList paths={scope.excluded_path_prefixes} empty="없음" />
        </dd>
        <dt className="text-muted">보관 기간</dt>
        <dd>{program.retention_days}일</dd>
      </dl>
    </Card>
  );
}

function programStatusLabel(status: string): string {
  const labels: Record<string, string> = { draft: "준비 중", active: "운영 중", paused: "일시 중지", closed: "종료" };
  return labels[status] ?? status;
}

function PathList({ paths, empty }: { paths: string[]; empty: string }) {
  if (paths.length === 0) return <span className="text-muted">{empty}</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {paths.map((path) => (
        <li key={path} className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
          {path}
        </li>
      ))}
    </ul>
  );
}
