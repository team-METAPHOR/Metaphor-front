"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, Icon, StatusBadge, formatShortTime } from "@/components/ui";
import { ApiError, api, type Schemas } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { orgKeys } from "../org/ui";
import { type Report, type ReportQuery, hintClass, reportCount, reportHint, useReportPage } from "./all-reports";

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

// 서버 정렬은 접수 시각 기준만 있다.
const SORT_OPTIONS: Option[] = [
  { value: "", label: "최신순" },
  { value: "oldest", label: "오래된순" },
];

type Filters = {
  status: string;
  period: string;
  site: string;
  assignee: string;
  mine: boolean;
  q: string;
  sort: string;
  page: number;
};

function readFilters(params: URLSearchParams): Filters {
  const page = Number(params.get("page"));
  return {
    status: params.get("status") ?? "",
    period: params.get("period") ?? "",
    site: params.get("site") ?? "",
    assignee: params.get("assignee") ?? "",
    mine: params.get("mine") === "1",
    q: params.get("q") ?? "",
    sort: params.get("sort") ?? "",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** 화면 필터를 서버 조건으로 바꾼다. 기간은 오늘 0시(브라우저 시간대)부터 N일. */
function toQuery(filters: Filters, now = new Date()): ReportQuery {
  let from: string | undefined;
  if (filters.period) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - (Number(filters.period) - 1));
    from = start.toISOString();
  }
  return {
    progress: filters.status || undefined,
    from,
    programId: filters.site || undefined,
    assignee: filters.mine ? "me" : filters.assignee || undefined,
    q: filters.q.trim() || undefined,
    sort: filters.sort === "oldest" ? "created_asc" : "created_desc",
    page: filters.page,
    limit: PAGE_SIZE,
  };
}

export function ReportsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { membership } = useSession();
  const filters = readFilters(searchParams);
  const reports = useReportPage(toQuery(filters));
  const members = useQuery({
    queryKey: orgKeys.members(membership.org_id),
    queryFn: () => api<Schemas["MemberResponse"][]>(`/orgs/${encodeURIComponent(membership.org_id)}/members`),
  });
  const programs = useQuery({ queryKey: ["programs"], queryFn: () => api<Schemas["ProgramList"]>("/programs") });

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
    ...(members.data ?? [])
      .filter((member) => member.is_active)
      .map((member) => ({ value: member.user_id, label: member.display_name ?? member.email })),
  ];
  const siteOptions: Option[] = [
    { value: "", label: "전체" },
    ...(programs.data?.items ?? []).map((program) => ({ value: program.id, label: program.name })),
  ];

  const total = reports.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = reports.data?.items ?? [];
  const statusLabel = STATUS_OPTIONS.find((option) => option.value === filters.status)?.label;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold">제보 목록</h1>
        <p className="text-[15px] text-subtle">
          {reports.data
            ? filters.status
              ? `${statusLabel} 제보 ${total.toLocaleString("ko-KR")}건`
              : `처리 중인 제보 ${total.toLocaleString("ko-KR")}건`
            : "제보를 불러오는 중…"}
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {siteOptions.length > 2 && (
            <FilterSelect label="사이트" value={filters.site} options={siteOptions} onChange={(v) => update({ site: v })} />
          )}
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
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={filters.q} onChange={(v) => update({ q: v })} />
          <FilterSelect label="정렬" value={filters.sort} options={SORT_OPTIONS} onChange={(v) => update({ sort: v })} />
        </div>
      </div>

      {reports.isPending ? (
        <TableSkeleton />
      ) : reports.isError ? (
        <ErrorMessage error={reports.error} />
      ) : (
        <>
          <ReportTable rows={rows} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted">
              {filters.status === "closed"
                ? "마감된 제보예요."
                : "마감된 제보는 목록에서 빠져요."}
            </p>
            <Pagination
              page={Math.min(filters.page, pageCount)}
              pageCount={pageCount}
              onChange={(next) => update({ page: String(next) })}
            />
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

/** 제목·내용 검색. 입력을 멈추고 0.3초 뒤에 주소에 반영한다. */
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  // 뒤로 가기 등으로 주소의 검색어가 바뀌면 입력칸도 따라간다.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);
  return (
    <label className="flex items-center rounded-lg border border-edge bg-surface px-3.5 py-[9px] text-sm leading-none focus-within:ring-2 focus-within:ring-primary/60">
      <span className="sr-only">제보 검색</span>
      <input
        type="search"
        value={text}
        maxLength={100}
        placeholder="제목·내용 검색"
        onChange={(event) => setText(event.target.value)}
        className="w-44 bg-transparent text-foreground outline-none placeholder:text-faint"
      />
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
