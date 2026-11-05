// 설정 모달은 지금 페이지 주소에 ?settings=<탭>(&program=<사이트 id>)를 붙여 연다.
// 그래서 어느 화면에서든 링크 하나로 특정 탭을 열 수 있다.

export const SETTINGS_TABS = ["general", "account", "sdk", "repro", "site", "members"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export function isSettingsTab(value: string | null): value is SettingsTab {
  return value != null && (SETTINGS_TABS as readonly string[]).includes(value);
}

/** 현재 경로를 유지한 채 설정 모달을 여는 주소. */
export function settingsHref(pathname: string, search: URLSearchParams, tab: SettingsTab, programId?: string): string {
  const params = new URLSearchParams(search.toString());
  params.set("settings", tab);
  if (programId) params.set("program", programId);
  return `${pathname}?${params.toString()}`;
}

/** 다른 화면에서 쓰는 링크. 지금 보던 화면 위에 모달을 연다(상대 주소). */
export function settingsLink(tab: SettingsTab, programId?: string): string {
  const params = new URLSearchParams({ settings: tab });
  if (programId) params.set("program", programId);
  return `?${params.toString()}`;
}
