import * as labels from "@/lib/labels";
import type { Lookup, Tone } from "@/lib/labels";

const toneClass: Record<Tone, string> = {
  neutral: "bg-chip text-subtle",
  info: "bg-primary-soft text-primary-ink",
  progress: "bg-sky-500/15 text-info",
  success: "bg-primary/15 text-primary-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger/10 text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

function makeBadge(lookup: Lookup) {
  return function LookupBadge({ value }: { value: string | null | undefined }) {
    const { label, tone } = lookup(value);
    return <Badge tone={tone}>{label}</Badge>;
  };
}

// 처리 상태, 진행 단계, 실행 상태, 재현 판정은 항상 각각의 배지로 따로 보여준다.
export const WorkflowBadge = makeBadge(labels.workflowStatus);
export const ProgressBadge = makeBadge(labels.progress);
export const JobStatusBadge = makeBadge(labels.jobStatus);
export const VerdictBadge = makeBadge(labels.verdict);
export const ClassificationBadge = makeBadge(labels.classification);
