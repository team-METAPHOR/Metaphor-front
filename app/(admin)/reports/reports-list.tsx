"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar, Icon, StatusBadge, formatShortTime } from "@/components/ui";
import { ApiError, api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { orgKeys } from "../org/ui";
import { MAX_REPORTS, type Report, hintClass, reportCount, reportHint, useAllReports } from "./all-reports";

const PAGE_SIZE = 20;

type Option = { value: string; label: string };

// 값이 ""이면 기본값. 기본 상태 필터는 마감된 신고를 뺀다.
const STATUS_OPTIONS: Option[] = [
  { value: "", label: "전체" },
  { value: "new", label: "신규" },
  { value: "reproducing", label: "재현 중" },
  { value: "reproduced", label: "재현됨" },
  { value: "triaged", label: "재현 안 됨" },
  { value: "waiting_quota", label: "한도 대기" },
  { value: "fixing", label: "버그 수정 중" },
  { value: "verified", label: "수정 확인됨" },
  { value: "dismissed", label: "버그 아님·중복" },
  { value: "closed", label: "마감" },
];

const PERIOD_OPTIONS: Option[] = [
  { value: "", label: "전체" },
  { value: "1", label: "오늘" },
  { value: "7", label: "최근 7일" },
  { value: "30", label: "최근 30일" },
];

const SORT_OPTIONS: Option[] = [
  { value: "", label: "최신순" },
  { value: "oldest", label: "오래된순" },
  { value: "reports", label: "신고 많은 순" },
];

type Filters = { status: string; period: string; assignee: string; mine: boolean; sort: string; page: number };

function readFilters(params: URLSearchParams): Filters {
  const page = Number(params.get("page"));
  return {
    status: params.get("status") ?? "",
    period: params.get("period") ?? "",
    assignee: params.get("assignee") ?? "",
    mine: params.get("mine") === "1",
    sort: params.get("sort") ?? "",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

function applyFilters(reports: Report[], filters: Filters, userId: string, now = Date.now()): Report[] {
  const since = filters.period
    ? new Date(new Date(now).setHours(0, 0, 0, 0)).getTime() - (Number(filters.period) - 1) * 86_400_000
    : null;
  const filtered = reports.filter((report) => {
    if (filters.status ? report.progress !== filters.status : report.progress === "closed") return false;
    if (since !== null && Date.parse(report.created_at) < since) return false;
    if (filters.mine && report.assignee?.id !== userId) return false;
    if (filters.assignee === "none" && report.assignee) return false;
    if (filters.assignee && filters.assignee !== "none" && report.assignee?.id !== filters.assignee) return false;
    return true;
  });
  const byDate = (a: Report, b: Report) => b.created_at.localeCompare(a.created_at);
  if (filters.sort === "oldest") return filtered.sort((a, b) => byDate(b, a));
  if (filters.sort === "reports") return filtered.sort((a, b) => b.duplicate_count - a.duplicate_count || byDate(a, b));
  return filtered.sort(byDate);
}

export function ReportsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, membership } = useSession();
  const filters = readFilters(searchParams);
  const reports = useAllReports();
  const members = useQuery({
    queryKey: orgKeys.members(membership.org_id),
    queryFn: () => api<Schemas["MemberResponse"][]>(`/orgs/${encodeURIComponent(membership.org_id)}/members`),
  });

  /** 필터가 바뀌면 첫 페이지로 돌아간다. */
  function update(changes: Partial<Record<keyof Filters, string>>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(changes)) {
      if (value) params.set(name, value);
      else params.delete(name);
    }
    if (!("page" in changes)) params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: "page" in changes });
  }

  const assigneeOptions: Option[] = [
    { value: "", label: "전체" },
    { value: "none", label: "없음" },
    ...(members.data ?? [])
      .filter((member) => member.is_active)
      .map((member) => ({ value: member.user_id, label: member.display_name ?? member.email })),
  ];

  const visible = reports.data ? applyFilters(reports.data.items, filters, user.id) : [];
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const statusLabel = STATUS_OPTIONS.find((option) => option.value === filters.status)?.label;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold">제보 목록</h1>
        <p className="text-[15px] text-subtle">
          {reports.data
            ? filters.status
              ? `${statusLabel} 제보 ${visible.length.toLocaleString("ko-KR")}건`
              : `처리 중인 제보 ${visible.length.toLocaleString("ko-KR")}건`
            : "제보를 불러오는 중…"}
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="상태" value={filters.status} options={STATUS_OPTIONS} onChange={(v) => update({ status: v })} />
          <FilterSelect label="기간" value={filters.period} options={PERIOD_OPTIONS} onChange={(v) => update({ period: v })} />
          <FilterSelect
            label="담당자"
            value={filters.assignee}
            options={assigneeOptions}
            onChange={(v) => update({ assignee: v, mine: "" })}
          />
          <button
            type="button"
            aria-pressed={filters.mine}
            onClick={() => update({ mine: filters.mine ? "" : "1", assignee: "" })}
            className={`rounded-lg border px-3.5 py-[9px] text-sm leading-none font-medium transition ${
              filters.mine ? "border-primary bg-primary-soft text-primary-ink" : "border-border text-label hover:bg-surface"
            }`}
          >
            내 담당만
          </button>
        </div>
        <FilterSelect label="정렬" value={filters.sort} options={SORT_OPTIONS} onChange={(v) => update({ sort: v })} />
      </div>

      {reports.isPending ? (
        <TableSkeleton />
      ) : reports.isError ? (
        <ErrorMessage error={reports.error} />
      ) : (
        <>
          {reports.data.truncated && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-ink">
              제보가 많아 최근 {MAX_REPORTS.toLocaleString("ko-KR")}건 안에서만 찾았어요.
            </p>
          )}
          <ReportTable rows={rows} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted">
              {filters.status === "closed"
                ? "마감된 제보예요."
                : "마감된 제보는 목록에서 빠져요."}
            </p>
            <Pagination page={page} pageCount={pageCount} onChange={(next) => update({ page: String(next) })} />
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative flex items-center gap-2 rounded-lg border border-edge bg-surface py-[9px] pr-3 pl-3.5 text-sm leading-none focus-within:ring-2 focus-within:ring-primary/60">
      <span className="text-subtle">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-5 font-medium text-foreground outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface">
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={14} className="pointer-events-none absolute right-3" />
    </label>
  );
}

// 상태 132 · 제목 · 번호 96 · 신고 수 64 · 담당 132 · 접수 96 (Figma 제보 목록)
const columns = "grid grid-cols-[132px_minmax(0,1fr)_96px_64px_132px_96px] items-center gap-4 px-6";

function ReportTable({ rows }: { rows: Report[] }) {
  return (
    // contain: 표 너비가 main을 밀어 넓히지 않고 이 안에서 가로 스크롤되게 한다.
    <div className="overflow-x-auto rounded-xl border border-edge bg-surface [contain:inline-size]">
      <div role="table" aria-label="제보 목록" className="min-w-[860px]">
        <div role="row" className={`${columns} border-b border-line py-3.5 text-[13px] text-muted`}>
          <span role="columnheader">상태</span>
          <span role="columnheader">제목</span>
          <span role="columnheader">번호</span>
          <span role="columnheader" className="text-center">
            신고 수
          </span>
          <span role="columnheader">담당</span>
          <span role="columnheader">접수</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-16 text-center text-[15px] text-subtle">조건에 맞는 제보가 없어요.</p>
        ) : (
          rows.map((report) => <ReportRow key={report.id} report={report} />)
        )}
      </div>
    </div>
  );
}

function ReportRow({ report }: { report: Report }) {
  const hint = reportHint(report);
  const done = report.progress === "dismissed" || report.progress === "closed";
  return (
    <Link
      role="row"
      href={`/reports/${encodeURIComponent(report.id)}`}
      className={`${columns} border-t border-line py-4 transition first:border-t-0 hover:bg-chip/40`}
    >
      <span role="cell">
        <StatusBadge progress={report.progress} />
      </span>
      <span role="cell" className="flex min-w-0 flex-col gap-1">
        <span className={`truncate text-base font-medium ${done ? "text-muted" : ""}`}>
          {report.title || "(제목 없음)"}
        </span>
        {hint.text && <span className={`truncate text-[13px] ${hintClass[hint.tone]}`}>{hint.text}</span>}
      </span>
      <span role="cell" className="font-mono text-[13px] text-body">
        BUG-{report.number}
      </span>
      <span role="cell" className="text-center text-[15px] font-medium text-body">
        {reportCount(report)}
      </span>
      <span role="cell" className="min-w-0">
        <AssigneeCell assignee={report.assignee} />
      </span>
      <span role="cell" className="text-sm text-subtle">
        {formatShortTime(report.created_at)}
      </span>
    </Link>
  );
}

/** 회사를 나간 담당자는 서버가 이름과 이메일을 가린다(active: false). */
function AssigneeCell({ assignee }: { assignee: Schemas["Assignee"] | null }) {
  if (!assignee) return <span className="text-sm text-faint">없음</span>;
  if (!assignee.active) return <span className="text-sm text-faint">(나간 멤버)</span>;
  const name = assignee.display_name ?? assignee.email ?? "";
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={name} />
      <span className="truncate text-sm font-medium text-body">{name}</span>
    </span>
  );
}

/** 현재 페이지 앞뒤로 최대 5개 번호를 보여준다. */
function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return null;
  const first = Math.max(1, Math.min(page - 2, pageCount - 4));
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => first + index);
  const arrow = "flex size-8 items-center justify-center rounded-lg hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <nav aria-label="페이지" className="flex items-center gap-1">
      <button type="button" className={arrow} disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="이전 페이지">
        <Icon name="page-prev" size={16} />
      </button>
      {pages.map((number) => (
        <button
          key={number}
          type="button"
          onClick={() => onChange(number)}
          aria-current={number === page ? "page" : undefined}
          className={`flex size-8 items-center justify-center rounded-lg text-sm ${
            number === page ? "bg-chip font-semibold text-foreground" : "text-subtle hover:bg-surface"
          }`}
        >
          {number}
        </button>
      ))}
      <button
        type="button"
        className={arrow}
        disabled={page === pageCount}
        onClick={() => onChange(page + 1)}
        aria-label="다음 페이지"
      >
        <Icon name="page-next" size={16} />
      </button>
    </nav>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-surface" aria-busy="true" aria-label="제보를 불러오는 중">
      <div className="h-12 border-b border-line" />
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-t border-line px-6 py-4 first:border-t-0">
          <span className="h-6 w-16 rounded-lg bg-chip" />
          <span className="h-4 flex-1 rounded bg-chip" />
        </div>
      ))}
    </div>
  );
}

function ErrorMessage({ error }: { error: Error }) {
  return (
    <div role="alert" className="rounded-xl bg-surface px-6 py-4 text-sm text-danger">
      <p>제보 목록을 불러오지 못했어요. {error.message}</p>
      {error instanceof ApiError && error.requestId && (
        <p className="mt-1 text-xs text-muted">요청 ID: {error.requestId}</p>
      )}
    </div>
  );
}
