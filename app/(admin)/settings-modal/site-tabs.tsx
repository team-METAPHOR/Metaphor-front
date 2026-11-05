"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { button } from "@/components/ui";
import { api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { OriginVerificationCard } from "../settings/origin-verification-card";
import { CreateProgramCard, ProgramCard } from "../settings/program-cards";
import { SdkSnippet } from "../settings/sdk-snippet";
import { ErrorText, widgetSettingsKey } from "../settings/ui";
import { WidgetSettingsCard } from "../settings/widget-settings-card";
import { NotReady, Section, SettingRow, Toggle, modalInput } from "./parts";
import { TestConditionsSection } from "./test-conditions";

type Program = Schemas["ProgramResponse"];
type ProgramList = Schemas["ProgramList"];
type WidgetSettings = Schemas["WidgetSettingsResponse"];

export type SiteTab = "sdk" | "repro" | "site";

/** 사이트 추가: 새 사이트를 등록한다. 등록하면 SDK와 설치 탭으로 넘어간다. */
export function NewSiteTab({ noSite, onCreated }: { noSite: boolean; onCreated: (programId: string) => void }) {
  const { isAdmin } = useSession();
  if (!isAdmin) return <p className="text-sm text-muted">사이트는 관리자만 추가할 수 있어요. 관리자에게 요청하세요.</p>;
  return (
    <>
      {noSite && (
        <p className="rounded-[10px] bg-surface-inset px-4 py-3 text-[13px] leading-5 text-subtle">
          아직 등록된 사이트가 없어요. 사이트를 추가하면 SDK와 설치, 재현 환경, 사이트 정보를 설정할 수 있어요.
        </p>
      )}
      <CreateProgramCard onCreated={(program) => onCreated(program.id)} />
    </>
  );
}

/** 사이트 탭(SDK와 설치, 재현 환경, 사이트 정보) 공통: 위쪽 사이트 선택 바와 선택된 사이트의 내용. */
export function SiteTabs({ tab, onAdd }: { tab: SiteTab; onAdd: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin } = useSession();
  const programs = useQuery({ queryKey: ["programs"], queryFn: () => api<ProgramList>("/programs") });

  function select(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("program", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (programs.isPending) return <p className="text-sm text-muted">사이트 목록을 불러오는 중…</p>;
  if (programs.isError) return <ErrorText error={programs.error} what="사이트 목록" />;

  const items = programs.data.items;
  // 사이트가 없으면 모달이 이 탭을 잠그고 사이트 추가로 보낸다.
  if (items.length === 0) return null;

  const selected = items.find((item) => item.id === searchParams.get("program")) ?? items[0];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-surface-inset px-4 py-3">
        <label className="flex min-w-0 items-center gap-2.5 text-[13px] text-muted">
          사이트
          <select
            value={selected.id}
            onChange={(event) => select(event.target.value)}
            className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-body outline-none focus:border-primary"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {hostOf(item.base_url)}
              </option>
            ))}
          </select>
        </label>
        {isAdmin && (
          <button type="button" className={button.ghost} onClick={onAdd}>
            + 사이트 추가
          </button>
        )}
      </div>
      {tab === "sdk" && <SdkTab key={selected.id} programId={selected.id} />}
      {tab === "repro" && <ReproTab key={selected.id} programId={selected.id} />}
      {tab === "site" && <SiteInfoTab key={selected.id} programId={selected.id} />}
    </>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function useProgram(programId: string) {
  return useQuery({
    queryKey: ["programs", programId],
    queryFn: () => api<Program>(`/programs/${encodeURIComponent(programId)}`),
  });
}

/** SDK와 설치: 설치 코드, 위젯 설정, 허용 Origin. 기존 사이트 설정 기능을 그대로 쓴다. */
function SdkTab({ programId }: { programId: string }) {
  const { isAdmin } = useSession();
  const settings = useQuery({
    queryKey: widgetSettingsKey(programId),
    queryFn: () => api<WidgetSettings>(`/programs/${encodeURIComponent(programId)}/widget-settings`),
  });
  if (settings.isPending) return <p className="text-sm text-muted">위젯 설정을 불러오는 중…</p>;
  if (settings.isError) return <ErrorText error={settings.error} what="위젯 설정" />;
  return (
    <>
      <SdkSnippet programId={programId} settings={settings.data} isAdmin={isAdmin} />
      <WidgetSettingsCard
        // 서버 값이 바뀌면 편집 중인 초안을 새 값으로 다시 시작한다.
        key={settings.data.updated_at ?? "never"}
        programId={programId}
        settings={settings.data}
        isAdmin={isAdmin}
      />
    </>
  );
}

/** 사이트 정보: 범위와 도메인 소유 확인. 기존 사이트 설정 기능을 그대로 쓴다. */
function SiteInfoTab({ programId }: { programId: string }) {
  const { isAdmin } = useSession();
  const program = useProgram(programId);
  return (
    <>
      <ProgramCard query={program} />
      <OriginVerificationCard programId={programId} isAdmin={isAdmin} />
    </>
  );
}

/**
 * 재현 환경. 테스트 조건은 서버와 연결돼 있다.
 * 재현 대상 주소 지정, 테스트 계정 저장(Metaphor-back#61), 위험 요청 차단은 화면만 있다.
 */
function ReproTab({ programId }: { programId: string }) {
  const program = useProgram(programId);
  const baseUrl = program.data?.scope.base_url ?? "";
  const hasSession = program.data?.scope.has_session === true;

  return (
    <>
      <NotReady>재현 대상 주소, 테스트 계정, 위험 요청 차단은 준비 중이에요. 지금은 사이트 기본 URL로 재현해요.</NotReady>

      <Section title="재현 환경" description="AI가 실제로 접속해서 버그를 따라 해 보는 곳이에요.">
        <div className="flex flex-col gap-2">
          <label htmlFor="repro-target" className="text-[13px] font-medium text-label">
            재현 대상 주소
          </label>
          <input id="repro-target" readOnly disabled value={baseUrl} className={`${modalInput} font-mono`} />
          <p className="text-xs leading-[18px] text-warning-ink">
            프로덕션을 지정하면 결제나 삭제 같은 요청이 실제로 일어날 수 있어요. 스테이징을 권장해요.
          </p>
        </div>

        <div className="mt-[18px] flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">테스트 계정</span>
              <span className="text-xs text-muted">로그인이 필요한 화면을 재현할 때 써요. 비밀번호는 암호화해서 저장해요.</span>
            </div>
            <button type="button" disabled className={button.ghost}>
              + 계정 추가
            </button>
          </div>
          <div className="rounded-[10px] border border-line px-4 py-3 text-[13px] text-muted">
            {hasSession
              ? "이 사이트에는 로그인 세션이 연결돼 있어요. 계정별 관리는 준비 중이에요."
              : "등록된 테스트 계정이 없어요."}
          </div>
        </div>
      </Section>

      <TestConditionsSection programId={programId} />

      <div className="rounded-[10px] bg-surface-inset px-[18px]">
        <SettingRow first label="위험 요청 차단" help="결제 승인, 삭제, 메일 발송 요청을 재현 중에 가로막아요.">
          <Toggle on label="위험 요청 차단" disabled />
        </SettingRow>
      </div>
    </>
  );
}
