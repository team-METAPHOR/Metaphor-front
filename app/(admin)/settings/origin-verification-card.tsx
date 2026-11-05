"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/badge";
import { ApiError, api, type Schemas } from "@/lib/api";
import { Card, CopyButton, ErrorText, errorMessage } from "./ui";

type OriginVerification = Schemas["OriginVerificationResponse"];

const originVerificationKey = (programId: string) => ["programs", programId, "origin-verification"] as const;

/** ORIGIN_VERIFY_FAILED 의 detail.reason 별 안내 */
const failureReasons: Record<string, string> = {
  PRIVATE_ADDRESS: "사내망이나 localhost 같은 비공개 주소라서 확인할 수 없어요. 인터넷에서 접속되는 도메인이어야 해요.",
  UNREACHABLE: "사이트에 접속하지 못했어요. 도메인과 서버가 살아 있는지 확인하세요.",
  REDIRECT: "파일 주소가 다른 곳으로 리다이렉트돼요. 리다이렉트 없이 바로 200으로 응답해야 해요.",
  NOT_FOUND: "파일을 찾지 못했어요. 아래 주소에 파일을 올렸는지 확인하세요.",
  MISMATCH: "파일 내용이 토큰과 달라요. 토큰 값만 그대로 넣으세요.",
};

function checkErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "ORIGIN_VERIFY_FAILED") {
      const reason = (error.detail as { reason?: string } | null)?.reason;
      return (reason && failureReasons[reason]) ?? error.message;
    }
    if (error.code === "ORIGIN_VERIFY_RATE_LIMITED" || error.status === 429) {
      return "확인을 너무 자주 시도했어요. 1분 뒤에 다시 시도하세요.";
    }
  }
  return errorMessage(error);
}

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("ko-KR") : "-";
}

/** 테스트 대상 도메인 소유 확인. 확인 전에는 위젯 신고와 AI 재현이 막힌다. */
export function OriginVerificationCard({ programId, isAdmin }: { programId: string; isAdmin: boolean }) {
  if (!isAdmin) {
    return (
      <Card title="도메인 소유 확인">
        <p className="text-sm text-muted">관리자만 확인할 수 있어요.</p>
      </Card>
    );
  }
  return <OriginVerificationAdmin programId={programId} />;
}

function OriginVerificationAdmin({ programId }: { programId: string }) {
  const queryClient = useQueryClient();
  const path = `/programs/${encodeURIComponent(programId)}/origin-verification`;
  const verification = useQuery({
    queryKey: originVerificationKey(programId),
    queryFn: () => api<OriginVerification>(path),
  });
  const check = useMutation({
    mutationFn: () => api<OriginVerification>(`${path}/check`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.setQueryData(originVerificationKey(programId), data);
      // 확인되면 서버가 위젯 설정의 reporting_enabled 를 켠다.
      return queryClient.invalidateQueries({ queryKey: ["programs", programId, "widget-settings"] });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: originVerificationKey(programId) }),
  });

  if (verification.isPending) {
    return (
      <Card title="도메인 소유 확인">
        <p className="text-sm text-muted">불러오는 중…</p>
      </Card>
    );
  }
  if (verification.isError) {
    return (
      <Card title="도메인 소유 확인">
        <ErrorText error={verification.error} what="도메인 소유 확인 정보" />
      </Card>
    );
  }

  const { origin, token, file_url, verified_at, last_checked_at } = verification.data;
  const verified = verified_at !== null;

  return (
    <Card
      title="도메인 소유 확인"
      description="이 사이트가 우리 것임을 확인해야 AI가 사이트에 접속해 버그를 재현해요."
      action={<Badge tone={verified ? "success" : "warning"}>{verified ? "확인됨" : "확인 필요"}</Badge>}
    >
      {!verified && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          확인 전에는 위젯으로 신고를 받을 수 없고, AI 재현 검증도 시작되지 않아요.
        </p>
      )}

      <ol className="list-decimal space-y-4 pl-5 text-sm">
        <li>
          <p>아래 토큰만 담은 텍스트 파일을 만드세요.</p>
          <Copyable value={token} />
        </li>
        <li>
          <p>이 주소에서 파일이 열리도록 사이트에 올리세요.</p>
          <Copyable value={file_url} />
        </li>
        <li>
          <p>올렸으면 확인하기를 누르세요.</p>
        </li>
      </ol>

      <dl className="mt-5 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-border pt-4 text-sm">
        <dt className="text-muted">대상 도메인</dt>
        <dd className="break-all font-mono text-xs leading-5">{origin}</dd>
        <dt className="text-muted">확인된 시각</dt>
        <dd>{formatTime(verified_at)}</dd>
        <dt className="text-muted">마지막 시도</dt>
        <dd>{formatTime(last_checked_at)}</dd>
      </dl>

      {check.isError && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          확인하지 못했어요. {checkErrorMessage(check.error)}
          {verified && " 이전 확인은 그대로 유지돼요."}
        </p>
      )}
      {check.isSuccess && (
        <p role="status" className="mt-4 text-sm text-green-700">
          도메인 소유가 확인됐어요.
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={check.isPending}
          onClick={() => check.mutate()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {check.isPending ? "확인 중…" : verified ? "다시 확인하기" : "확인하기"}
        </button>
      </div>
    </Card>
  );
}

function Copyable({ value }: { value: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <code className="min-w-0 flex-1 break-all text-xs">{value}</code>
      <CopyButton text={value} />
    </div>
  );
}
