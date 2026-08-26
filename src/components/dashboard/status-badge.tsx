import { CheckCircle2, Clock3, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/schemas/content";
import { cn } from "@/lib/utils";

const statusConfig = {
  queued: {
    label: "Queued",
    icon: Clock3,
    className: "border-slate-300 bg-slate-100 text-slate-700"
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    className: "border-primary/20 bg-primary/10 text-primary"
  },
  retrying: {
    label: "Retrying",
    icon: RotateCcw,
    className: "border-accent/25 bg-accent/15 text-accent-foreground"
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700"
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "border-destructive/20 bg-destructive/10 text-destructive"
  }
} satisfies Record<JobStatus, { label: string; icon: typeof Clock3; className: string }>;

export function StatusBadge({ status }: { status: JobStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1.5", config.className)}>
      <Icon
        className={cn("size-3.5", status === "processing" ? "animate-spin" : undefined)}
        aria-hidden="true"
      />
      {config.label}
    </Badge>
  );
}
