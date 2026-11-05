"use client";

import { useState } from "react";
import { button } from "@/components/ui";
import { type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { ConfirmDialog, formatDateTime } from "../org/ui";
import {
  TestAccountForm,
  notInUseReason,
  successSignal,
  testAccountError,
  useDeleteTestAccount,
  useTestAccount,
} from "../settings/test-account-form";
import { ErrorText } from "../settings/ui";

/** 재현 환경 탭의 테스트 계정: 사이트마다 하나. 등록·수정·삭제는 관리자만. */
export function TestAccountSection({ programId, scope }: { programId: string; scope?: Schemas["ScopeResponse"] }) {
  const { isAdmin } = useSession();
  const account = useTestAccount(programId);
  const remove = useDeleteTestAccount(programId);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const data = account.data;
  const configured = data?.configured === true;

  return (
    <div className="mt-[18px] flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">테스트 계정</span>
          <span className="text-xs text-muted">로그인이 필요한 화면을 재현할 때 써요. 비밀번호는 암호화해서 저장해요.</span>
        </div>
        {isAdmin && data && !editing && (
          <button type="button" className={button.ghost} onClick={() => setEditing(true)}>
            {configured ? "수정" : "+ 계정 추가"}
          </button>
        )}
      </div>

      {account.isPending && <div className="h-16 animate-pulse rounded-[10px] bg-surface-inset" aria-busy="true" />}
      {account.isError && <ErrorText error={account.error} what="테스트 계정" />}

      {data && editing && (
        <div className="rounded-[10px] bg-surface-inset px-[18px] py-4">
          <TestAccountForm
            programId={programId}
            account={data}
            submitLabel={configured ? "저장" : "계정 추가"}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        </div>
      )}

      {data && !editing && !configured && (
        <div className="rounded-[10px] border border-line px-4 py-3 text-[13px] text-muted">
          {scope?.has_session
            ? "운영자가 연결한 로그인 세션으로 재현해요. 저장된 테스트 계정은 없어요."
            : "등록된 테스트 계정이 없어요."}
        </div>
      )}

      {data && !editing && configured && (
        <div className="flex flex-col gap-2 rounded-[10px] border border-line px-4 py-3">
          <div className="flex items-start gap-4">
            <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
              <dt className="text-muted">아이디</dt>
              <dd className="truncate font-mono">{data.login_id_masked}</dd>
              <dt className="text-muted">로그인 화면</dt>
              <dd className="truncate font-mono">
                {data.login_path ?? "없음"}
                {data.submit_path && <span className="text-muted"> → {data.submit_path}</span>}
              </dd>
              <dt className="text-muted">성공 확인</dt>
              <dd className="truncate font-mono">{successSignal(data)}</dd>
              {data.updated_at && (
                <>
                  <dt className="text-muted">저장</dt>
                  <dd className="text-subtle">{formatDateTime(data.updated_at)}</dd>
                </>
              )}
            </dl>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-subtle">
              <span className={`size-1.5 rounded-full ${data.in_use ? "bg-primary" : "bg-warning-ink"}`} aria-hidden />
              {data.in_use ? "사용 중" : "쓰이지 않음"}
            </span>
          </div>
          {!data.in_use && (
            <p className="text-xs text-warning-ink">저장은 됐지만 실행에 쓰이지 않아요. {notInUseReason(data, scope)}</p>
          )}
          {isAdmin && (
            <div className="flex justify-end">
              <button
                type="button"
                className="text-[13px] font-medium text-danger hover:brightness-110"
                onClick={() => setConfirming(true)}
              >
                삭제
              </button>
            </div>
          )}
          {!isAdmin && <p className="text-xs text-muted">테스트 계정은 관리자만 바꿀 수 있어요.</p>}
        </div>
      )}

      {isAdmin && (
        <ConfirmDialog
          open={confirming}
          title="테스트 계정을 지울까요?"
          description="지우면 다음 재현부터 로그인하지 않아요. 지난 실행 결과는 그대로 남아요."
          confirmLabel="삭제"
          pendingLabel="지우는 중…"
          isPending={remove.isPending}
          error={null}
          // 실패해도 창을 닫고 아래에 이유를 보여준다(이 API의 에러 문구로).
          onConfirm={() => remove.mutate(undefined, { onSettled: () => setConfirming(false) })}
          onClose={() => setConfirming(false)}
        />
      )}
      {remove.error && (
        <p role="alert" className="text-sm text-danger">
          테스트 계정을 지우지 못했어요. {testAccountError(remove.error)}
        </p>
      )}
    </div>
  );
}
