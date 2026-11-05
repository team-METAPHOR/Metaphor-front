"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

export type ThemePreference = "system" | "light" | "dark";
type Theme = "light" | "dark";

const DEFAULT: ThemePreference = "dark";
const CHANGE_EVENT = "spear-theme-change";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "system" || value === "light" || value === "dark" ? value : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function resolve(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  return window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark";
}

function apply(preference: ThemePreference) {
  document.documentElement.setAttribute("data-theme", resolve(preference));
}

function subscribe(onChange: () => void) {
  // 다른 탭에서 바꾼 값도 따라간다.
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** 테마 선택값과 바꾸는 함수. 선택값은 이 브라우저(localStorage)에만 저장된다. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => DEFAULT);
  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 저장할 수 없어도 이번 화면에는 적용한다.
    }
    apply(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return { preference, setPreference };
}

function subscribeApplied(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readApplied(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/** 지금 화면에 적용된 테마("시스템"이면 OS 설정을 풀어 쓴 값). */
export function useAppliedTheme(): Theme {
  return useSyncExternalStore(subscribeApplied, readApplied, () => "dark");
}

/**
 * <html data-theme>를 선택값과 맞춘다. 다른 탭에서 바꾼 경우와,
 * "시스템"일 때 OS 설정이 바뀐 경우를 처리한다. Providers에 한 번만 둔다.
 */
export function ThemeSync() {
  const { preference } = useTheme();
  useEffect(() => {
    apply(preference);
    if (preference !== "system") return;
    const media = window.matchMedia(LIGHT_QUERY);
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);
  return null;
}
