"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { button } from "@/components/ui";
import { ApiError, api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import {
  BROWSERS,
  MAX_CONDITIONS,
  conditionSummary,
  conditionsKey,
  useTestConditions,
  type Browser,
} from "@/lib/test-conditions";
import { ErrorText, errorMessage } from "../settings/ui";
import { Section, Toggle, modalInput } from "./parts";

type Condition = Schemas["TestConditionOut"];

/** 화면 크기 바로 고르기. 직접 넣은 값이 이 중 하나와 같으면 그 칸이 켜진다. */
const SIZES = [
  { label: "데스크톱", width: 1280, height: 800 },
  { label: "노트북", width: 1440, height: 900 },
  { label: "태블릿", width: 768, height: 1024 },
  { label: "모바일", width: 390, height: 844 },
];

const CONDITION_ERRORS: Record<string, string> = {
  CONDITION_EXISTS: "같은 조건 ID가 이미 있어요. 다른 ID를 쓰세요.",
  CONDITION_LIMIT_EXCEEDED: `조건은 사이트마다 ${MAX_CONDITIONS}개까지 등록할 수 있어요.`,
  INVALID_CONDITION: "재현 엔진이 받을 수 없는 조건이에요. 값을 확인하세요.",
  CREDENTIALS_REQUIRE_HTTPS: "로그인 세션이 연결된 조건은 HTTPS 사이트에서만 고칠 수 있어요.",
};

function conditionError(error: unknown): string {
  const code = error instanceof ApiError ? error.code : null;
  if (code && CONDITION_ERRORS[code]) return CONDITION_ERRORS[code];
  // 이름에 이메일·전화번호 같은 개인정보가 있으면 서버가 422로 거절한다.
  if (error instanceof ApiError && error.status === 422) return "입력값을 확인하세요. 이름에는 개인정보를 넣을 수 없어요.";
  return errorMessage(error);
}

/** 재현 환경 탭의 테스트 조건: 목록과 추가·수정·삭제(admin). 바꾸면 바로 저장된다. */
export function TestConditionsSection({ programId }: { programId: string }) {
  const { isAdmin } = useSession();
  const conditions = useTestConditions(programId);
  // null: 닫힘, "new": 새 조건, 그 밖: 고치는 조건 ID
  const [editing, setEditing] = useState<string | null>(null);
  const items = conditions.data?.items ?? [];
  const full = items.length >= MAX_CONDITIONS;

  return (
    <Section
      title="테스트 조건"
      description="계정·브라우저·화면 크기·응답 속도를 바꿔 같은 신고를 재현해 봐요. 재현을 요청할 때 조건을 고르면 조건마다 따로 실행해요."
    >
      {conditions.isPending && <div className="h-24 animate-pulse rounded-[10px] bg-surface-inset" aria-busy="true" />}
      {conditions.isError && <ErrorText error={conditions.error} what="테스트 조건" />}
      {conditions.data && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-label">
              등록한 조건 {items.length}/{MAX_CONDITIONS}
            </span>
            {isAdmin && editing !== "new" && (
              <button
                type="button"
                className={button.ghost}
                disabled={full}
                title={full ? `조건은 ${MAX_CONDITIONS}개까지 등록할 수 있어요.` : undefined}
                onClick={() => setEditing("new")}
              >
                + 조건 추가
              </button>
            )}
          </div>
          {editing === "new" && <ConditionForm programId={programId} onDone={() => setEditing(null)} />}
          {items.length === 0 && editing !== "new" ? (
            <p className="rounded-[10px] border border-line px-4 py-3 text-[13px] text-muted">
              등록한 조건이 없어요. 조건 없이 재현하면 사이트 기본 설정으로 한 번 실행해요.
            </p>
          ) : (
            items.length > 0 && (
              <ul className="overflow-hidden rounded-[10px] border border-line">
                {items.map((condition) =>
                  editing === condition.condition_id ? (
                    <li key={condition.condition_id} className="border-line p-2 [&:not(:first-child)]:border-t">
                      <ConditionForm programId={programId} condition={condition} onDone={() => setEditing(null)} />
                    </li>
                  ) : (
                    <ConditionRow
                      key={condition.condition_id}
                      programId={programId}
                      condition={condition}
                      canEdit={isAdmin}
                      onEdit={() => setEditing(condition.condition_id)}
                    />
                  ),
                )}
              </ul>
            )
          )}
        </div>
      )}
    </Section>
  );
}

function ConditionRow({
  programId,
  condition,
  canEdit,
  onEdit,
}: {
  programId: string;
  condition: Condition;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () =>
      api<void>(
        `/programs/${encodeURIComponent(programId)}/test-conditions/${encodeURIComponent(condition.condition_id)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: conditionsKey(programId) }),
  });

  return (
    <li className="flex flex-col gap-2 border-line px-4 py-3 [&:not(:first-child)]:border-t">
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate text-sm font-medium">{condition.label}</span>
          <span className="truncate text-xs text-muted">
            {conditionSummary(condition)}
            {condition.record_video && " · 영상 녹화"}
          </span>
        </div>
        {condition.has_session && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-subtle">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            로그인 세션 연결됨
          </span>
        )}
        {canEdit && !confirming && (
          <span className="flex shrink-0 gap-3 text-[13px] font-medium">
            <button type="button" className="text-label hover:text-foreground" onClick={onEdit}>
              수정
            </button>
            <button type="button" className="text-danger hover:brightness-110" onClick={() => setConfirming(true)}>
              삭제
            </button>
          </span>
        )}
      </div>
      {confirming && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-inset px-3 py-2 text-[13px]">
          <span>이 조건을 지울까요? 지난 실행 결과는 그대로 남아요.</span>
          <span className="flex gap-2">
            <button
              type="button"
              className={button.ghost}
              disabled={remove.isPending}
              onClick={() => {
                setConfirming(false);
                remove.reset();
              }}
            >
              취소
            </button>
            <button
              type="button"
              className={`${button.ghost} text-danger`}
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? "지우는 중…" : "삭제"}
            </button>
          </span>
        </div>
      )}
      {remove.error && (
        <p role="alert" className="text-sm text-danger">
          조건을 지우지 못했어요. {conditionError(remove.error)}
        </p>
      )}
    </li>
  );
}

type Draft = {
  condition_id: string;
  label: string;
  browser_name: Browser;
  width: string;
  height: string;
  response_delay_ms: string;
  test_context_id: string;
  record_video: boolean;
};

function draftOf(condition?: Condition): Draft {
  return {
    condition_id: condition?.condition_id ?? "",
    label: condition?.label ?? "",
    browser_name: (condition?.browser_name as Browser | undefined) ?? "chromium",
    width: String(condition?.width ?? 1280),
    height: String(condition?.height ?? 800),
    response_delay_ms: String(condition?.response_delay_ms ?? 0),
    test_context_id: condition?.test_context_id ?? "anonymous",
    record_video: condition?.record_video ?? false,
  };
}

/** 조건 추가·수정 폼. 조건 ID는 등록한 뒤 바꿀 수 없다. */
function ConditionForm({ programId, condition, onDone }: { programId: string; condition?: Condition; onDone: () => void }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState(() => draftOf(condition));
  const set = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));
  const editing = condition != null;

  const save = useMutation({
    mutationFn: () => {
      const fields = {
        label: draft.label.trim(),
        browser_name: draft.browser_name,
        width: Number(draft.width),
        height: Number(draft.height),
        response_delay_ms: Number(draft.response_delay_ms),
        test_context_id: draft.test_context_id.trim(),
        record_video: draft.record_video,
      };
      const base = `/programs/${encodeURIComponent(programId)}/test-conditions`;
      return editing
        ? api<Condition>(`${base}/${encodeURIComponent(condition.condition_id)}`, { method: "PATCH", body: fields })
        : api<Condition>(base, { method: "POST", body: { condition_id: draft.condition_id.trim(), ...fields } });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: conditionsKey(programId) });
      onDone();
    },
  });

  const contextChanged = editing && condition.has_session && draft.test_context_id.trim() !== condition.test_context_id;

  return (
    <form
      className="flex flex-col gap-3.5 rounded-[10px] bg-surface-inset px-[18px] py-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <span className="text-sm font-semibold">{editing ? `${condition.label} 고치기` : "새 조건"}</span>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="이름" help="신고 화면에 그대로 보여요. 개인정보는 넣지 마세요.">
          <input
            required
            maxLength={200}
            value={draft.label}
            onChange={(event) => set({ label: event.target.value })}
            placeholder="일반 직원 · Safari 모바일"
            className={modalInput}
          />
        </Field>
        <Field label="조건 ID" help={editing ? "조건 ID는 바꿀 수 없어요." : "영문·숫자·-·_ 64자까지. 등록하면 바꿀 수 없어요."}>
          <input
            required
            pattern="[A-Za-z0-9_\-]{1,64}"
            disabled={editing}
            value={draft.condition_id}
            onChange={(event) => set({ condition_id: event.target.value })}
            placeholder="staff-safari-mobile"
            className={`${modalInput} font-mono`}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Field label="브라우저" group>
          <Segmented
            options={BROWSERS.map((browser) => ({ key: browser.value, label: browser.label }))}
            selected={draft.browser_name}
            onSelect={(value) => set({ browser_name: value as Browser })}
          />
        </Field>
        <Field label="화면 크기" help="320×320부터 1920×1080까지 정할 수 있어요." group>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              options={SIZES.map((size) => ({ key: `${size.width}x${size.height}`, label: size.label }))}
              selected={`${draft.width}x${draft.height}`}
              onSelect={(key) => {
                const [width, height] = key.split("x");
                set({ width, height });
              }}
            />
            <input
              required
              type="number"
              min={320}
              max={1920}
              aria-label="가로"
              value={draft.width}
              onChange={(event) => set({ width: event.target.value })}
              className={`${modalInput} !w-20`}
            />
            <span className="text-[13px] text-muted">×</span>
            <input
              required
              type="number"
              min={320}
              max={1080}
              aria-label="세로"
              value={draft.height}
              onChange={(event) => set({ height: event.target.value })}
              className={`${modalInput} !w-20`}
            />
          </div>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="응답 지연 (ms)" help="느린 네트워크를 흉내 내요. 0~2000">
          <input
            required
            type="number"
            min={0}
            max={2000}
            step={100}
            value={draft.response_delay_ms}
            onChange={(event) => set({ response_delay_ms: event.target.value })}
            className={modalInput}
          />
        </Field>
        <Field
          label="테스트 계정 ID"
          help={
            contextChanged
              ? "계정 ID를 바꾸면 연결된 로그인 세션이 풀려요."
              : "계정마다 로그인 세션은 운영자가 연결해요. 로그인 없이 돌리려면 anonymous."
          }
          warn={contextChanged}
        >
          <input
            required
            value={draft.test_context_id}
            onChange={(event) => set({ test_context_id: event.target.value })}
            className={`${modalInput} font-mono`}
          />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-[3px]">
          <span className="text-[13px] font-medium text-label">영상 녹화</span>
          <span className="text-xs text-muted">재현 서버에서 녹화가 켜져 있을 때만 영상이 남아요.</span>
        </div>
        <Toggle on={draft.record_video} label="영상 녹화" onChange={(on) => set({ record_video: on })} />
      </div>
      {save.error && (
        <p role="alert" className="text-sm text-danger">
          조건을 저장하지 못했어요. {conditionError(save.error)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={button.ghost} disabled={save.isPending} onClick={onDone}>
          취소
        </button>
        <button type="submit" className={button.primary} disabled={save.isPending}>
          {save.isPending ? "저장 중…" : editing ? "저장" : "조건 추가"}
        </button>
      </div>
    </form>
  );
}

/** 라벨 + 입력 + 도움말. 버튼 묶음처럼 입력이 여러 개면 group으로 label 대신 div를 쓴다. */
function Field({
  label,
  help,
  warn,
  group,
  children,
}: {
  label: string;
  help?: string;
  warn?: boolean;
  group?: boolean;
  children: React.ReactNode;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="flex min-w-0 flex-col gap-1.5" role={group ? "group" : undefined} aria-label={group ? label : undefined}>
      <span className="text-[13px] font-medium text-label">{label}</span>
      {children}
      {help && <span className={`text-xs ${warn ? "text-warning-ink" : "text-muted"}`}>{help}</span>}
    </Tag>
  );
}

function Segmented({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex w-fit gap-0.5 rounded-lg bg-background p-[3px]">
      {options.map((option) => {
        const on = option.key === selected;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(option.key)}
            className={`rounded-md px-3 py-1.5 text-[13px] transition ${
              on ? "bg-chip font-medium text-foreground" : "text-muted hover:text-body"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
