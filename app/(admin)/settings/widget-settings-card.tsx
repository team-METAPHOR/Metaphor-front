"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/badge";
import { api, type Schemas } from "@/lib/api";
import { Card, errorMessage, widgetSettingsKey } from "./ui";

type WidgetSettings = Schemas["WidgetSettingsResponse"];
type WidgetSettingsPatch = Schemas["WidgetSettingsPatch"];

const MAX_ORIGINS = 20;

const toggles = [
  { field: "widget_enabled", label: "위젯 사용", help: "끄면 SDK가 고객사 사이트에 신고 버튼을 띄우지 않아요." },
  { field: "public_reporting_enabled", label: "엔드유저 신고 받기", help: "고객사 사이트 방문자의 신고를 접수해요." },
  { field: "auto_detect_enabled", label: "오류 자동 감지", help: "JS 오류, Promise 오류, 5xx 응답이 나면 신고를 안내해요." },
  { field: "live_screenshot_enabled", label: "화면 캡처", help: "신고할 때 입력 영역을 가린 스크린샷을 첨부할 수 있어요." },
] as const;

type ToggleField = (typeof toggles)[number]["field"];

const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

/**
 * scheme://host[:port] 형식이면 정규화한 Origin을, 아니면 오류 문구를 돌려준다.
 * 서버와 같이 https만 받고, http는 localhost·127.0.0.1만 받는다.
 */
function normalizeOrigin(input: string): { origin: string } | { error: string } {
  const value = input.trim();
  const formatError = { error: "scheme://host[:port] 형식으로 입력하세요. 예: https://shop.example.com" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return formatError;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return formatError;
  // 경로, 쿼리, 끝 슬래시, 사용자 정보가 붙은 값은 Origin이 아니다.
  if (url.origin.toLowerCase() !== value.toLowerCase()) return formatError;
  if (url.protocol === "http:" && !LOCAL_HOSTS.includes(url.hostname)) {
    return { error: "https 주소만 등록할 수 있어요. http는 localhost, 127.0.0.1만 쓸 수 있어요." };
  }
  return { origin: url.origin };
}

export function WidgetSettingsCard({
  programId,
  settings,
  isAdmin,
}: {
  programId: string;
  settings: WidgetSettings;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  // 허용 Origin은 관리자가 관리하는 전체 목록이다. kind는 서버가 붙이는 표시일 뿐이다:
  // approved = 사이트 기본 URL의 Origin, mapped = 그 밖의 Origin(운영 사이트 등).
  const initialOrigins = settings.allowed_origins.map((o) => o.origin);
  const mappedOrigins = new Set(settings.allowed_origins.filter((o) => o.kind === "mapped").map((o) => o.origin));

  const [flags, setFlags] = useState<Record<ToggleField, boolean>>(() => ({
    widget_enabled: settings.widget_enabled,
    public_reporting_enabled: settings.public_reporting_enabled,
    auto_detect_enabled: settings.auto_detect_enabled,
    live_screenshot_enabled: settings.live_screenshot_enabled,
  }));
  const [origins, setOrigins] = useState<string[]>(initialOrigins);
  const [newOrigin, setNewOrigin] = useState("");
  const [originError, setOriginError] = useState<string | null>(null);

  // 바뀐 필드만 보낸다. null을 보내면 서버가 거부한다.
  const patch: WidgetSettingsPatch = {};
  for (const { field } of toggles) {
    if (flags[field] !== settings[field]) patch[field] = flags[field];
  }
  const originsChanged =
    origins.length !== initialOrigins.length || origins.some((origin, i) => origin !== initialOrigins[i]);
  if (originsChanged) patch.allowed_origins = origins;
  const dirty = Object.keys(patch).length > 0;

  const save = useMutation({
    mutationFn: (body: WidgetSettingsPatch) =>
      api<WidgetSettings>(`/programs/${encodeURIComponent(programId)}/widget-settings`, { method: "PATCH", body }),
    onSuccess: (data) => {
      // updated_at이 바뀌면 부모가 key로 이 카드를 새 값으로 다시 그린다.
      queryClient.setQueryData(widgetSettingsKey(programId), data);
    },
  });

  function addOrigin() {
    const normalized = normalizeOrigin(newOrigin);
    if ("error" in normalized) {
      setOriginError(normalized.error);
      return;
    }
    const { origin } = normalized;
    if (origins.includes(origin)) {
      setOriginError("이미 있는 Origin이에요.");
      return;
    }
    if (origins.length >= MAX_ORIGINS) {
      setOriginError(`최대 ${MAX_ORIGINS}개까지 등록할 수 있어요.`);
      return;
    }
    setOrigins([...origins, origin]);
    setNewOrigin("");
    setOriginError(null);
  }

  function reset() {
    setFlags({
      widget_enabled: settings.widget_enabled,
      public_reporting_enabled: settings.public_reporting_enabled,
      auto_detect_enabled: settings.auto_detect_enabled,
      live_screenshot_enabled: settings.live_screenshot_enabled,
    });
    setOrigins(initialOrigins);
    setNewOrigin("");
    setOriginError(null);
    save.reset();
  }

  return (
    <Card
      title="위젯 설정"
      description={
        settings.updated_at ? `마지막 변경 ${new Date(settings.updated_at).toLocaleString("ko-KR")}` : "아직 변경한 적 없어요."
      }
    >
      {!isAdmin && (
        <p className="mb-4 rounded-lg bg-background px-3 py-2 text-xs text-muted">관리자만 설정을 바꿀 수 있어요.</p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty) save.mutate(patch);
        }}
      >
        <fieldset disabled={!isAdmin || save.isPending} className="space-y-6">
          <div className="divide-y divide-border">
            {toggles.map(({ field, label, help }) => (
              <label key={field} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted">{help}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={flags[field]}
                  onChange={(event) => setFlags({ ...flags, [field]: event.target.checked })}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="relative h-6 w-11 shrink-0 rounded-full bg-chip transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-disabled:opacity-50"
                />
              </label>
            ))}
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium">허용 Origin</h3>
              <span className="text-xs text-muted">
                {origins.length}/{MAX_ORIGINS}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">SDK가 신고를 보낼 수 있는 고객사 사이트 주소예요.</p>

            <ul className="mt-3 space-y-1.5">
              {origins.map((origin) => (
                <li
                  key={origin}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-xs">{origin}</span>
                    {mappedOrigins.has(origin) && (
                      <span
                        className="shrink-0"
                        title="사이트 기본 URL과 다른 Origin이에요. 이곳(운영 사이트 등)에서 온 신고는 기본 URL에서 재현해요."
                      >
                        <Badge>운영 Origin</Badge>
                      </span>
                    )}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setOrigins(origins.filter((o) => o !== origin))}
                      className="shrink-0 text-xs text-muted hover:text-danger"
                      aria-label={`${origin} 삭제`}
                    >
                      삭제
                    </button>
                  )}
                </li>
              ))}
              {origins.length === 0 && (
                <li className="text-xs text-muted">등록된 Origin이 없어요.</li>
              )}
            </ul>

            {isAdmin && (
              <div className="mt-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="https://shop.example.com"
                    value={newOrigin}
                    onChange={(event) => {
                      setNewOrigin(event.target.value);
                      setOriginError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addOrigin();
                      }
                    }}
                    aria-label="추가할 Origin"
                    aria-invalid={originError !== null}
                    className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 font-mono text-xs outline-none focus:border-primary aria-invalid:border-red-400"
                  />
                  <button
                    type="button"
                    onClick={addOrigin}
                    disabled={origins.length >= MAX_ORIGINS}
                    className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
                {originError && (
                  <p role="alert" className="mt-1.5 text-xs text-danger">
                    {originError}
                  </p>
                )}
              </div>
            )}
          </div>
        </fieldset>

        {save.isError && (
          <p role="alert" className="mt-4 text-sm text-danger">
            저장하지 못했어요. {errorMessage(save.error)}
          </p>
        )}

        {isAdmin && (
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={!dirty || save.isPending}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background disabled:opacity-50"
            >
              되돌리기
            </button>
            <button
              type="submit"
              disabled={!dirty || save.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {save.isPending ? "저장 중…" : "저장"}
            </button>
          </div>
        )}
      </form>
    </Card>
  );
}
