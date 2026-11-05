"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { api, type Schemas } from "@/lib/api";
import { AccountView } from "../account/account-view";
import { OrgView } from "../org/org-view";
import { GeneralTab } from "./general-tab";
import { isSettingsTab, settingsHref, type SettingsTab } from "./links";
import { NewSiteTab, SiteTabs } from "./site-tabs";

type ProgramList = Schemas["ProgramList"];

const NAV: { group: string; items: { tab: SettingsTab; label: string }[] }[] = [
  {
    group: "개인",
    items: [
      { tab: "general", label: "일반" },
      { tab: "account", label: "계정" },
    ],
  },
  {
    group: "사이트",
    items: [
      { tab: "new-site", label: "사이트 추가" },
      { tab: "sdk", label: "SDK와 설치" },
      { tab: "repro", label: "재현 환경" },
      { tab: "site", label: "사이트 정보" },
    ],
  },
  { group: "조직", items: [{ tab: "members", label: "멤버와 초대" }] },
];

/** 주소에 ?settings=<탭>이 있으면 설정 모달을 띄운다. 관리 레이아웃에 한 번 둔다. */
export function SettingsModal() {
  const searchParams = useSearchParams();
  const value = searchParams.get("settings");
  if (!isSettingsTab(value)) return null;
  return <SettingsDialog tab={value} />;
}

/** 사이트가 하나 있어야 내용이 생기는 탭. 사이트가 없으면 잠근다. */
const NEEDS_SITE: readonly SettingsTab[] = ["sdk", "repro", "site"];

function SettingsDialog({ tab }: { tab: SettingsTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialog = useRef<HTMLDialogElement>(null);
  const programs = useQuery({ queryKey: ["programs"], queryFn: () => api<ProgramList>("/programs") });
  const noSite = programs.data?.items.length === 0;
  const locked = (item: SettingsTab) => noSite && NEEDS_SITE.includes(item);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function go(next: SettingsTab, programId?: string) {
    router.replace(settingsHref(pathname, searchParams, next, programId), { scroll: false });
  }

  // 잠긴 탭으로 들어온 링크(?settings=sdk 등)는 사이트 추가로 보낸다.
  const redirect = locked(tab);
  useEffect(() => {
    if (redirect) router.replace(settingsHref(pathname, searchParams, "new-site"), { scroll: false });
  }, [redirect, router, pathname, searchParams]);

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("settings");
    params.delete("program");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="settings-title"
      // Esc로 닫혀도 주소에서 ?settings를 지워 상태를 맞춘다.
      // React는 안쪽 확인 대화상자(키 재발급, 멤버 역할 변경 등)의 close도 여기로 올려 보내므로
      // 설정 모달 자신이 닫힐 때만 처리한다.
      onClose={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
      className="m-auto h-[min(760px,calc(100dvh-32px))] w-[min(1040px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-border bg-background p-0 text-foreground shadow-[0_16px_48px_rgb(0_0_0/0.4)] backdrop:bg-black/55"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-line px-6 py-[18px]">
          <h2 id="settings-title" className="text-lg font-semibold">
            설정
          </h2>
          <button
            type="button"
            aria-label="설정 닫기"
            onClick={() => dialog.current?.close()}
            className="rounded-md p-1 text-subtle hover:bg-chip hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav
            aria-label="설정 메뉴"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-surface-inset px-3 py-3 sm:w-[232px] sm:flex-col sm:gap-3.5 sm:overflow-y-auto sm:border-r sm:border-b-0 sm:py-5"
          >
            {NAV.map(({ group, items }) => (
              <div key={group} className="flex shrink-0 gap-0.5 sm:flex-col">
                <span className="hidden px-3 pb-1 text-xs font-medium text-faint sm:block">{group}</span>
                {items.map((item) => {
                  const active = item.tab === tab;
                  const off = locked(item.tab);
                  return (
                    <button
                      key={item.tab}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      disabled={off}
                      title={off ? "사이트를 먼저 추가하세요" : undefined}
                      onClick={() => go(item.tab)}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap ${
                        active
                          ? "bg-chip font-semibold"
                          : off
                            ? "font-medium text-faint"
                            : "font-medium text-subtle hover:text-foreground"
                      }`}
                    >
                      {item.label}
                      {off && (
                        <svg width="14" height="14" viewBox="0 0 24 24" aria-label="잠김" className="shrink-0">
                          <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                          <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto px-5 pt-7 pb-9 sm:px-9">
            <div className="flex flex-col gap-8">
              {tab === "general" && <GeneralTab />}
              {tab === "account" && <AccountView />}
              {(tab === "sdk" || tab === "repro" || tab === "site") && !redirect && (
                <SiteTabs tab={tab} onAdd={() => go("new-site")} />
              )}
              {tab === "new-site" && <NewSiteTab noSite={noSite} onCreated={(programId) => go("sdk", programId)} />}
              {tab === "members" && <OrgView />}
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
