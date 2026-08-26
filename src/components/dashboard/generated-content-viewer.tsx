"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GeneratedContentRow } from "@/lib/jobs/types";

function buildCopyText(content: GeneratedContentRow) {
  return [
    content.hook,
    "",
    content.body,
    "",
    "Alternative hooks:",
    ...content.alternative_hooks.map((hook) => `- ${hook}`),
    "",
    "Key points:",
    ...content.key_points.map((point) => `- ${point}`),
    "",
    `CTA: ${content.cta}`
  ].join("\n");
}

export function GeneratedContentViewer({
  content
}: {
  content: GeneratedContentRow | null;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!content) {
      return;
    }

    await navigator.clipboard.writeText(buildCopyText(content));
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1600);
  }

  if (!content) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <div>
          <h2 className="text-base font-semibold">No generated content yet</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Completed jobs will show the validated hook, body, key points, and CTA here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="surface-panel rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Generated content</h2>
          <p className="text-sm text-muted-foreground">Validated structured output</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void handleCopy();
          }}
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="space-y-6 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Hook
          </p>
          <p className="mt-2 text-lg font-semibold leading-7">{content.hook}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Body
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
            {content.body}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Alternative hooks
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {content.alternative_hooks.map((hook) => (
                <li key={hook} className="rounded-md bg-muted px-3 py-2">
                  {hook}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Key points
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {content.key_points.map((point) => (
                <li key={point} className="rounded-md bg-secondary px-3 py-2 text-secondary-foreground">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border border-accent/25 bg-accent/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            CTA
          </p>
          <p className="mt-2 text-sm font-medium leading-6">{content.cta}</p>
        </div>
      </div>
    </section>
  );
}
