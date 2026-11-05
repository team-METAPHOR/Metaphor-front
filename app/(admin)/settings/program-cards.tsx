"use client";

import { type UseQueryResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/badge";
import { api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import {
  type DraftErrors,
  ProgramFields,
  changesScope,
  diffPatch,
  draftFrom,
  emptyDraft,
  originOf,
  parseDraft,
  programErrorMessage,
  programStatusLabel,
} from "./program-form";
import { Card, ErrorText } from "./ui";

type Program = Schemas["ProgramResponse"];
type ProgramPatch = Schemas["ProgramPatch"];

const primaryButton =
  "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50";
const secondaryButton = "rounded-lg border border-border px-4 py-2 text-sm hover:bg-background disabled:opacity-50";

/** 사이트 등록(관리자). 성공하면 새 사이트를 돌려준다. */
export function CreateProgramCard({ onCreated, onCancel }: { onCreated: (program: Program) => void; onCancel?: () => void }) {
  const { membership } = useSession();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const create = useMutation({
    mutationFn: (body: Schemas["ProgramCreate"]) =>
      api<Program>("/programs", { method: "POST", body, idempotent: true }),
    onSuccess: async (program) => {
      queryClient.setQueryData(["programs", program.id], program);
      await queryClient.invalidateQueries({ queryKey: ["programs"], exact: true });
      onCreated(program);
    },
  });

  return (
    <Card title="사이트 등록" description="버그를 재현할 테스트 사이트를 등록해요.">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = parseDraft(draft);
          setErrors(parsed.errors ?? {});
          if (parsed.value) create.mutate({ org_id: membership.org_id, ...parsed.value });
        }}
      >
        <fieldset disabled={create.isPending}>
          <ProgramFields draft={draft} errors={errors} onChange={setDraft} />
        </fieldset>
        <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-ink">
          등록한 뒤 도메인 소유 확인을 마쳐야 위젯으로 신고를 받고 AI 재현 검증을 시작할 수 있어요.
        </p>
        {create.isError && (
          <p role="alert" className="mt-4 text-sm text-danger">
            등록하지 못했어요. {programErrorMessage(create.error)}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={create.isPending} className={secondaryButton}>
              취소
            </button>
          )}
          <button type="submit" disabled={create.isPending} className={primaryButton}>
            {create.isPending ? "등록 중…" : "등록"}
          </button>
        </div>
      </form>
    </Card>
  );
}

/** 사이트 정보. 관리자는 수정할 수 있다. */
export function ProgramCard({ query }: { query: UseQueryResult<Program> }) {
  const { isAdmin } = useSession();
  const [editing, setEditing] = useState(false);

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
  if (editing) return <ProgramEditForm program={program} onDone={() => setEditing(false)} />;

  const { scope } = program;
  return (
    <Card
      title="사이트 정보"
      description={isAdmin ? `범위 리비전 ${program.current_revision}` : "관리자만 바꿀 수 있어요."}
      action={
        isAdmin && (
          <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-background">
            수정
          </button>
        )
      }
    >
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
        <dt className="text-muted">외부 AI 분석</dt>
        <dd>{program.external_ai_allowed ? "허용" : "허용 안 함"}</dd>
        <dt className="text-muted">자동 재생성</dt>
        <dd>{program.auto_fresh_retries}회</dd>
        <dt className="text-muted">화면 크기</dt>
        <dd>
          {scope.width}×{scope.height}
        </dd>
        <dt className="text-muted">앱 버전</dt>
        <dd className="font-mono text-xs leading-5">{scope.app_version}</dd>
        <dt className="text-muted">보관 기간</dt>
        <dd>{program.retention_days}일</dd>
      </dl>
    </Card>
  );
}

function ProgramEditForm({ program, onDone }: { program: Program; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => draftFrom(program));
  const [errors, setErrors] = useState<DraftErrors>({});
  const save = useMutation({
    mutationFn: (body: ProgramPatch) =>
      api<Program>(`/programs/${encodeURIComponent(program.id)}`, { method: "PATCH", body }),
    onSuccess: async (data) => {
      queryClient.setQueryData(["programs", program.id], data);
      // 목록 이름·URL, 위젯 허용 Origin 구분, 도메인 소유 확인 대상이 함께 바뀔 수 있다.
      await queryClient.invalidateQueries({ queryKey: ["programs"] });
      onDone();
    },
  });

  // 입력이 아직 규칙에 안 맞아도 바뀐 범위는 알려 준다.
  const parsed = parseDraft(draft);
  const patch = parsed.value ? diffPatch(program, parsed.value) : null;
  const draftOrigin = originOf(draft.base_url);
  const originChanged = draftOrigin !== null && draftOrigin !== originOf(program.scope.base_url);
  const scopeChanged = patch ? changesScope(patch) : originChanged;
  const dirty = patch === null || Object.keys(patch).length > 0;

  return (
    <Card title="사이트 정보 수정" description={`범위 리비전 ${program.current_revision}`}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setErrors(parsed.errors ?? {});
          if (patch && Object.keys(patch).length > 0) save.mutate(patch);
        }}
      >
        <fieldset disabled={save.isPending}>
          <ProgramFields draft={draft} errors={errors} onChange={setDraft} />
        </fieldset>

        {(originChanged || scopeChanged) && (
          <div role="note" className="mt-4 space-y-1.5 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-ink">
            {originChanged && (
              <p>
                <strong>도메인이 바뀌어요.</strong> 새 도메인은 소유 확인을 다시 받아야 하고, 확인 전에는 위젯 신고와 AI 재현
                검증이 멈춰요. 전에 확인한 도메인으로 되돌리면 그 확인이 다시 쓰여요.
              </p>
            )}
            {originChanged && program.scope.has_session && (
              <p>연결된 로그인 세션이 해제돼요. 운영자에게 다시 연결해 달라고 요청해야 해요.</p>
            )}
            {scopeChanged && (
              <p>
                승인 범위가 바뀌어 리비전이 {program.current_revision + 1}(으)로 올라가요. 이전 리비전에서 나온 결과로는
                재검증을 비교할 수 없어 새 검증이 필요해요.
              </p>
            )}
          </div>
        )}

        {save.isError && (
          <p role="alert" className="mt-4 text-sm text-danger">
            저장하지 못했어요. {programErrorMessage(save.error)}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onDone} disabled={save.isPending} className={secondaryButton}>
            취소
          </button>
          <button type="submit" disabled={!dirty || save.isPending} className={primaryButton}>
            {save.isPending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Card>
  );
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
