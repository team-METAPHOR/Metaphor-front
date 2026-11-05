"use client";

import { useTheme, type ThemePreference } from "@/lib/theme";
import { Section, SettingRow } from "./parts";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "시스템" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
];

/** 일반: 화면 테마. 이 탭은 실제로 동작한다. */
export function GeneralTab() {
  const { preference, setPreference } = useTheme();

  return (
    <>
      <Section title="화면 모드" description="관리 콘솔의 색 테마를 골라요. 이 브라우저에만 저장돼요.">
        <div role="radiogroup" aria-label="테마" className="grid grid-cols-1 gap-3.5 pt-1 sm:grid-cols-3">
          {OPTIONS.map((option) => {
            const selected = preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPreference(option.value)}
                className="group flex flex-col gap-2.5 text-left"
              >
                <ThemePreview kind={option.value} selected={selected} />
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`size-4 rounded-full ${selected ? "border-[5px] border-primary" : "border-[1.5px] border-border"}`}
                  />
                  <span className={`text-sm ${selected ? "font-semibold" : "font-medium text-subtle"}`}>
                    {option.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="표시">
        <SettingRow first label="테마 빠르게 바꾸기" help="사이드바 아래 버튼으로도 바꿀 수 있어요.">
          <div className="flex rounded-lg border border-border bg-surface-inset p-[3px]">
            {OPTIONS.map((option) => {
              const selected = preference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPreference(option.value)}
                  className={`rounded-md px-3 py-1.5 text-[13px] ${
                    selected ? "bg-chip font-semibold" : "font-medium text-muted hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </SettingRow>
      </Section>
    </>
  );
}

const PALETTE = {
  light: { bg: "#f6f6f6", bar: "#ffffff", card: "#e6e6e6" },
  dark: { bg: "#1e1e1e", bar: "#232323", card: "#2f2f2f" },
};

/** 테마 미리보기. 고르는 대상이라 현재 테마와 무관하게 각 테마의 실제 색으로 그린다. */
function ThemePreview({ kind, selected }: { kind: ThemePreference; selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative block h-28 overflow-hidden rounded-[10px] ${
        selected ? "outline-2 outline-primary" : "outline outline-border group-hover:outline-border-strong"
      }`}
    >
      {kind === "system" ? (
        <>
          <MiniApp colors={PALETTE.light} />
          <span className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
            <span className="absolute inset-y-0 right-0 w-[200%]">
              <MiniApp colors={PALETTE.dark} />
            </span>
          </span>
        </>
      ) : (
        <MiniApp colors={PALETTE[kind]} />
      )}
    </span>
  );
}

function MiniApp({ colors }: { colors: { bg: string; bar: string; card: string } }) {
  return (
    <span className="absolute inset-0 flex" style={{ background: colors.bg }}>
      <span className="relative w-[46px] shrink-0" style={{ background: colors.bar }}>
        <span className="absolute top-4 left-3 h-1.5 w-[22px] rounded-full bg-[#00dc7d]" />
      </span>
      <span className="flex flex-1 flex-col gap-2.5 px-3.5 pt-4">
        <span className="h-2 w-14 rounded" style={{ background: colors.card }} />
        <span className="h-[18px] w-full rounded" style={{ background: colors.card }} />
        <span className="h-[18px] w-full rounded" style={{ background: colors.card }} />
      </span>
    </span>
  );
}
