"use client";

import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  contentPlatformSchema,
  contentToneSchema,
  type ContentPlatform,
  type ContentTone
} from "@/lib/schemas/content";

const tones = contentToneSchema.options;
const platforms = contentPlatformSchema.options;

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function NewGenerationForm() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState<ContentTone>("professional");
  const [platform, setPlatform] = useState<ContentPlatform>("linkedin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedJobId, setQueuedJobId] = useState<string | null>(null);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitJob();
  }

  async function submitJob() {
    setIsSubmitting(true);
    setError(null);
    setQueuedJobId(null);

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        topic,
        audience,
        tone,
        platform
      })
    });

    const payload = (await response.json()) as { jobId?: string; error?: string };
    setIsSubmitting(false);

    if (!response.ok || !payload.jobId) {
      setError(payload.error ?? "Unable to queue generation job.");
      return;
    }

    setQueuedJobId(payload.jobId);
    setTopic("");
    setAudience("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="surface-panel rounded-lg p-5">
      <div>
        <h2 className="text-base font-semibold">New generation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Queue a content job for background processing.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="topic">Topic</Label>
          <Input
            id="topic"
            value={topic}
            onChange={(event) => {
              setTopic(event.target.value);
            }}
            placeholder="AI onboarding for customer success teams"
            minLength={5}
            maxLength={220}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="audience">Audience</Label>
          <Input
            id="audience"
            value={audience}
            onChange={(event) => {
              setAudience(event.target.value);
            }}
            placeholder="B2B SaaS founders"
            minLength={3}
            maxLength={160}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <Select
              id="tone"
              value={tone}
              onChange={(event) => {
                setTone(event.target.value as ContentTone);
              }}
            >
              {tones.map((toneOption) => (
                <option key={toneOption} value={toneOption}>
                  {titleCase(toneOption)}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select
              id="platform"
              value={platform}
              onChange={(event) => {
                setPlatform(event.target.value as ContentPlatform);
              }}
            >
              {platforms.map((platformOption) => (
                <option key={platformOption} value={platformOption}>
                  {platformOption === "x" ? "X" : titleCase(platformOption)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {queuedJobId ? (
        <p className="mt-4 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
          Job queued: {queuedJobId}
        </p>
      ) : null}

      <Button type="submit" className="mt-5 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
        Queue job
      </Button>
    </form>
  );
}
