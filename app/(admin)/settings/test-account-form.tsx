"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { button } from "@/components/ui";
import { ApiError, api, type Schemas } from "@/lib/api";
import { modalInput } from "../settings-modal/parts";
import { errorMessage } from "./ui";

export type TestAccount = Schemas["TestAccountResponse"];
type TestAccountPut = Schemas["TestAccountPut"];
type Scope = Schemas["ScopeResponse"];

export const programKey = (programId: string) => ["programs", programId] as const;
export const testAccountKey = (programId: string) => ["programs", programId, "test-account"] as const;

const accountPath = (programId: string) => `/programs/${encodeURIComponent(programId)}/test-account`;

/** 사이트의 테스트 계정 상태. 비밀번호와 전체 아이디는 서버가 돌려주지 않는다. */
export function useTestAccount(programId: string) {
  return useQuery({ queryKey: testAccountKey(programId), queryFn: () => api<TestAccount>(accountPath(programId)) });
}

/** 저장·삭제 뒤 계정 상태와 프로그램(scope.has_test_account 등)을 다시 받는다. */
export function useInvalidateTestAccount(programId: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: testAccountKey(programId) }),
      client.invalidateQueries({ queryKey: programKey(programId), exact: true }),
    ]);
}

export function useDeleteTestAccount(programId: string) {
  const invalidate = useInvalidateTestAccount(programId);
  return useMutation({
    mutationFn: () => api<void>(accountPath(programId), { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

const PATH_REASONS: Record<string, string> = {
  PATH_EXCLUDED: "제외한 경로 안에 있어요.",
  PATH_OUT_OF_SCOPE: "허용한 경로 밖이에요.",
};

/** 테스트 계정 API의 에러 코드를 한국어 안내로 바꾼다. 입력값(특히 비밀번호)은 다시 보여주지 않는다. */
export function testAccountError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "VALIDATION_FAILED":
        return "입력값을 확인하세요. 경로는 /로 시작하고 ?, #, \\, 공백을 넣을 수 없어요.";
      case "LOGIN_PATH_OUT_OF_SCOPE": {
        const reason = (error.detail as { reason?: string } | null)?.reason;
        const why = (reason && PATH_REASONS[reason]) ?? "승인된 테스트 범위 밖이에요.";
        return `입력한 경로가 ${why} 사이트 정보의 허용 경로를 확인하세요.`;
      }
      case "LOGIN_CONFIG_INVALID":
        return "성공 경로는 로그인 화면 경로와 달라야 해요.";
      case "CREDENTIALS_REQUIRE_HTTPS":
        return "테스트 계정은 HTTPS 사이트에서만 쓸 수 있어요. 사이트 주소를 HTTPS로 바꾼 뒤 저장하세요.";
      case "TEST_ACCOUNT_RATE_LIMITED":
        return "테스트 계정은 사이트마다 한 시간에 10번까지 저장·삭제할 수 있어요. 잠시 후 다시 시도하세요.";
      case "TEST_ACCOUNT_UNAVAILABLE":
        return "지금은 테스트 계정을 저장할 수 없어요. 서버 암호화 설정이 필요하니 운영자에게 알려 주세요.";
      case "CSRF_REJECTED":
        return "허용되지 않은 출처에서 보낸 요청이에요.";
    }
    if (error.status === 403) return "테스트 계정은 관리자만 바꿀 수 있어요.";
    if (error.status === 422) return "입력값을 확인하세요.";
  }
  return errorMessage(error);
}

/** 저장은 됐지만 실행에 쓰이지 않는 이유(configured && !in_use). 서버 _in_use 조건 순서대로 본다. */
export function notInUseReason(account: TestAccount, scope?: Scope): string {
  if (!account.login_path) return "로그인 화면 경로가 없어요.";
  if (!account.success_path && !account.success_selector) return "성공 경로나 성공 요소가 없어 로그인 성공을 확인할 수 없어요.";
  if (scope && !scope.base_url.startsWith("https://")) return "사이트 주소가 HTTPS가 아니에요.";
  if (scope?.test_context_id === "anonymous") return "사이트 정보의 테스트 컨텍스트 ID가 anonymous예요.";
  // 남은 조건: 운영자가 연결한 로그인 세션이 있으면 엔진이 그 세션을 먼저 쓴다.
  return "운영자가 연결한 로그인 세션이 있어 그 세션으로 실행해요.";
}

/** 로그인 성공을 확인하는 방법 한 줄. */
export function successSignal(account: TestAccount): string {
  const parts = [
    account.success_path && `경로 ${account.success_path}`,
    account.success_selector && `요소 ${account.success_selector}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "없음";
}

// 서버 LOGIN_PATH_PATTERN과 같다: /로 시작, //로 시작하지 않음, ? # \ 공백 없음.
const PATH = /^\/(?:[^/?#\\\s][^?#\\\s]*)?$/;

type Draft = {
  login_id: string;
  password: string;
  login_path: string;
  submit_path: string;
  success_path: string;
  success_selector: string;
};

function validate(draft: Draft): string | null {
  if (!draft.login_id.trim()) return "로그인 아이디를 입력하세요.";
  if (!draft.password) return "비밀번호를 입력하세요.";
  const loginPath = draft.login_path.trim();
  if (!loginPath) return "로그인 화면 경로를 입력하세요. 예: /login";
  for (const [label, value] of [
    ["로그인 화면 경로", loginPath],
    ["로그인 요청 경로", draft.submit_path.trim()],
    ["성공 경로", draft.success_path.trim()],
  ]) {
    if (value && !PATH.test(value)) return `${label}는 /로 시작하는 경로만 쓸 수 있어요. ?, #, \\, 공백은 넣을 수 없어요.`;
  }
  if (!draft.success_path.trim() && !draft.success_selector.trim()) {
    return "로그인이 성공했는지 확인할 성공 경로나 성공 요소 중 하나는 넣어 주세요.";
  }
  if (draft.success_path.trim() === loginPath) return "성공 경로는 로그인 화면 경로와 달라야 해요.";
  return null;
}

const optional = (value: string) => value.trim() || null;

/**
 * 테스트 계정 저장·교체 폼(admin). 설정 모달과 신고의 "재현하려면 이것이 필요해요" 카드가 같이 쓴다.
 * 서버가 아이디·비밀번호를 돌려주지 않으므로 고칠 때도 둘 다 다시 입력한다. 비밀번호는 미리 채우지 않는다.
 */
export function TestAccountForm({
  programId,
  account,
  submitLabel,
  onCancel,
  onSaved,
}: {
  programId: string;
  account?: TestAccount;
  submitLabel?: string;
  onCancel: () => void;
  onSaved: (account: TestAccount) => void;
}) {
  const invalidate = useInvalidateTestAccount(programId);
  const [draft, setDraft] = useState<Draft>(() => ({
    login_id: "",
    password: "",
    login_path: account?.login_path ?? "",
    submit_path: account?.submit_path ?? "",
    success_path: account?.success_path ?? "",
    success_selector: account?.success_selector ?? "",
  }));
  const [invalid, setInvalid] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));
  const editing = account?.configured === true;

  const save = useMutation({
    mutationFn: () => {
      const body: TestAccountPut = {
        login_id: draft.login_id.trim(),
        password: draft.password,
        login_path: optional(draft.login_path),
        submit_path: optional(draft.submit_path),
        success_path: optional(draft.success_path),
        success_selector: optional(draft.success_selector),
        // PUT은 전체 교체라 화면에서 고치지 않는 값도 저장된 값 그대로 다시 보낸다.
        unauthenticated_paths: account?.unauthenticated_paths ?? [],
      };
      return api<TestAccount>(accountPath(programId), { method: "PUT", body });
    },
    onSuccess: async (saved) => {
      set({ password: "" });
      await invalidate();
      onSaved(saved);
    },
  });

  return (
    <form
      className="flex flex-col gap-3.5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const problem = validate(draft);
        setInvalid(problem);
        if (problem) return;
        save.mutate();
      }}
    >
      {editing && (
        <p className="text-xs text-muted">저장된 아이디와 비밀번호는 다시 볼 수 없어요. 고치려면 둘 다 다시 입력하세요.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="로그인 아이디">
          <input
            value={draft.login_id}
            onChange={(event) => set({ login_id: event.target.value })}
            maxLength={254}
            autoComplete="off"
            placeholder={account?.login_id_masked ?? "qa-member@example.com"}
            className={`${modalInput} font-mono`}
          />
        </Field>
        <Field label="비밀번호">
          <input
            type="password"
            value={draft.password}
            onChange={(event) => set({ password: event.target.value })}
            maxLength={256}
            autoComplete="new-password"
            className={modalInput}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="로그인 화면 경로" help="아이디·비밀번호 입력칸이 있는 화면이에요.">
          <input
            value={draft.login_path}
            onChange={(event) => set({ login_path: event.target.value })}
            maxLength={2048}
            placeholder="/login"
            className={`${modalInput} font-mono`}
          />
        </Field>
        <Field label="로그인 요청 경로 (선택)" help="폼이 다른 경로로 보내면 넣어요. 비우면 로그인 화면 경로로 보내요.">
          <input
            value={draft.submit_path}
            onChange={(event) => set({ submit_path: event.target.value })}
            maxLength={2048}
            placeholder="/api/auth"
            className={`${modalInput} font-mono`}
          />
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-label">성공 확인</span>
        <span className="text-xs text-muted">
          로그인이 성공했는지 확인할 방법을 하나 이상 넣어요. 둘 다 넣으면 둘 다 확인해요.
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="성공 경로" help="로그인한 뒤 도착하는 경로예요.">
            <input
              value={draft.success_path}
              onChange={(event) => set({ success_path: event.target.value })}
              maxLength={2048}
              placeholder="/app/home"
              className={`${modalInput} font-mono`}
            />
          </Field>
          <Field label="성공 요소 (CSS 선택자)" help="로그인한 뒤에만 보이는 요소예요.">
            <input
              value={draft.success_selector}
              onChange={(event) => set({ success_selector: event.target.value })}
              maxLength={256}
              placeholder="#signed-in"
              className={`${modalInput} font-mono`}
            />
          </Field>
        </div>
      </div>
      <p className="text-xs text-muted">
        아이디·비밀번호 입력칸과 제출 버튼은 자동으로 찾아요. 2단계 인증, CAPTCHA, 외부 SSO 로그인은 지원하지 않아요.
        비밀번호는 암호화해서 저장하고 재현할 때만 써요.
      </p>
      {(invalid || save.error) && (
        <p role="alert" className="text-sm text-danger">
          {invalid ?? `테스트 계정을 저장하지 못했어요. ${testAccountError(save.error)}`}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={button.ghost} disabled={save.isPending} onClick={onCancel}>
          취소
        </button>
        <button type="submit" className={button.primary} disabled={save.isPending}>
          {save.isPending ? "저장 중…" : (submitLabel ?? "저장")}
        </button>
      </div>
    </form>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-label">{label}</span>
      {children}
      {help && <span className="text-xs text-muted">{help}</span>}
    </label>
  );
}
