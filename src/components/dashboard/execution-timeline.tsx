import type { JobExecutionEvent } from "@/lib/jobs/types";
import type { Json } from "@/types/database";

function jsonRecord(value: Json) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value;
}

export function ExecutionTimeline({ events }: { events: JobExecutionEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        No execution events have been recorded yet.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => {
        const metadata = jsonRecord(event.metadata);

        return (
          <li key={event.id} className="surface-panel rounded-lg p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold capitalize">{event.event_type}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.message}</p>
              </div>
              <time className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short"
                }).format(new Date(event.created_at))}
              </time>
            </div>
            {Object.keys(metadata).length > 0 ? (
              <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs leading-5 text-muted-foreground">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
