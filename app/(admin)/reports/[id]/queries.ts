"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ApiError, api, type Schemas } from "@/lib/api";
import { ACTIVE_JOB_STATUSES, type EngineResult } from "@/types/report";

type Report = Schemas["ReportDetail"];
type Job = Schemas["JobOut"];
type EventList = Schemas["EventList"];
type JobResult = Schemas["JobResult"];
type Handoff = Schemas["DeveloperHandoff"];
type ArtifactList = Schemas["ArtifactList"];
type JobList = Schemas["JobList"];

const POLL_MS = 3_000;
const HANDOFF_POLL_MS = 5_000;

export const reportKeys = {
  report: (reportId: string) => ["report", reportId] as const,
  handoff: (reportId: string) => ["report", reportId, "handoff"] as const,
  jobs: (reportId: string) => ["report", reportId, "jobs"] as const,
  job: (jobId: string) => ["validation-job", jobId] as const,
  events: (jobId: string) => ["validation-job", jobId, "events"] as const,
  result: (jobId: string) => ["validation-job", jobId, "result"] as const,
  artifacts: (jobId: string) => ["validation-job", jobId, "artifacts"] as const,
};

export function isActiveJob(status: string | null | undefined): boolean {
  return status != null && ACTIVE_JOB_STATUSES.includes(status);
}

function isStatus(error: unknown, ...statuses: number[]): boolean {
  return error instanceof ApiError && statuses.includes(error.status);
}

/** 404, 403은 다시 요청해도 같으니 재시도하지 않는다. */
function retryUnlessDenied(count: number, error: unknown): boolean {
  return !isStatus(error, 401, 403, 404) && count < 2;
}

export function useReport(reportId: string) {
  return useQuery({
    queryKey: reportKeys.report(reportId),
    queryFn: () => api<Report>(`/reports/${encodeURIComponent(reportId)}`),
    retry: retryUnlessDenied,
  });
}

/** 신고의 모든 실행(최신순). 최근 100건까지. 실행 중인 것이 있으면 3초마다 다시 받는다. */
export function useReportJobs(reportId: string) {
  return useQuery({
    queryKey: reportKeys.jobs(reportId),
    queryFn: ({ signal }) =>
      api<JobList>(`/reports/${encodeURIComponent(reportId)}/validation-jobs?limit=100`, { signal }),
    retry: retryUnlessDenied,
    refetchInterval: (query) => (query.state.data?.items.some((job) => isActiveJob(job.status)) ? POLL_MS : false),
  });
}

/** job이 끝나는 순간 결과, 분석, artifact, 신고(latest_job 요약)를 다시 받는다. */
function invalidateFinishedJob(client: QueryClient, reportId: string, jobId: string) {
  void client.invalidateQueries({ queryKey: reportKeys.report(reportId), exact: true });
  void client.invalidateQueries({ queryKey: reportKeys.handoff(reportId) });
  void client.invalidateQueries({ queryKey: reportKeys.jobs(reportId) });
  void client.invalidateQueries({ queryKey: reportKeys.result(jobId) });
  void client.invalidateQueries({ queryKey: reportKeys.artifacts(jobId) });
  void client.invalidateQueries({ queryKey: reportKeys.events(jobId) });
}

/** 실행 중(queued/running/cancelling)이면 3초마다 다시 받고, 끝나면 멈춘다. */
export function useJob(reportId: string, jobId: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: reportKeys.job(jobId),
    queryFn: async () => {
      const previous = client.getQueryData<Job>(reportKeys.job(jobId));
      const job = await api<Job>(`/validation-jobs/${encodeURIComponent(jobId)}`);
      if (previous && isActiveJob(previous.status) && !isActiveJob(job.status)) {
        invalidateFinishedJob(client, reportId, jobId);
      }
      return job;
    },
    refetchInterval: (query) => (isActiveJob(query.state.data?.status) ? POLL_MS : false),
    // 폴링 중에는 캐시를 오래된 값으로 두지 않는다.
    staleTime: 0,
  });
}

/** 진행 로그. 실행 중이면 마지막 id 이후만 이어 받아 붙인다. */
export function useJobEvents(jobId: string, active: boolean) {
  const client = useQueryClient();
  return useQuery({
    queryKey: reportKeys.events(jobId),
    queryFn: async () => {
      const previous = client.getQueryData<EventList>(reportKeys.events(jobId))?.items ?? [];
      const lastId = previous.at(-1)?.id;
      const query = lastId == null ? "" : `?after=${lastId}`;
      const page = await api<EventList>(`/validation-jobs/${encodeURIComponent(jobId)}/events${query}`);
      const seen = new Set(previous.map((event) => event.id));
      return { items: [...previous, ...page.items.filter((event) => !seen.has(event.id))] };
    },
    refetchInterval: active ? POLL_MS : false,
  });
}

/** 끝나지 않은 job은 결과가 404일 수 있다. 에러가 아니라 "결과 대기"(null)로 다룬다. */
export function useJobResult(jobId: string) {
  return useQuery({
    queryKey: reportKeys.result(jobId),
    queryFn: async (): Promise<EngineResult | null> => {
      try {
        const data = await api<JobResult>(`/validation-jobs/${encodeURIComponent(jobId)}/result`);
        return (data.result ?? {}) as EngineResult;
      } catch (error) {
        if (isStatus(error, 404, 409)) return null;
        throw error;
      }
    },
    retry: retryUnlessDenied,
  });
}

export function useHandoff(reportId: string) {
  return useQuery({
    queryKey: reportKeys.handoff(reportId),
    queryFn: () => api<Handoff>(`/reports/${encodeURIComponent(reportId)}/developer-handoff`),
    refetchInterval: (query) => (query.state.data?.state === "pending" ? HANDOFF_POLL_MS : false),
    retry: retryUnlessDenied,
  });
}

export function useArtifacts(jobId: string) {
  return useQuery({
    queryKey: reportKeys.artifacts(jobId),
    queryFn: () => api<ArtifactList>(`/validation-jobs/${encodeURIComponent(jobId)}/artifacts`),
    retry: retryUnlessDenied,
  });
}

export function evidenceUrl(artifactId: string): string {
  return `/api/v1/evidence/${encodeURIComponent(artifactId)}/download`;
}
