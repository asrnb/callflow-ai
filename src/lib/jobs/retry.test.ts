import { describe, expect, it } from "vitest";
import {
  getBackoffDelaySeconds,
  getDurationMs,
  sanitizeError,
  shouldRetryAttempt
} from "@/lib/jobs/retry";

describe("retry helpers", () => {
  it("uses capped exponential backoff", () => {
    expect(getBackoffDelaySeconds(1)).toBe(30);
    expect(getBackoffDelaySeconds(2)).toBe(60);
    expect(getBackoffDelaySeconds(3)).toBe(120);
    expect(getBackoffDelaySeconds(20)).toBe(300);
  });

  it("stops retrying at the configured max attempt", () => {
    expect(shouldRetryAttempt(1, 3)).toBe(true);
    expect(shouldRetryAttempt(2, 3)).toBe(true);
    expect(shouldRetryAttempt(3, 3)).toBe(false);
  });

  it("normalizes errors and durations for persistence", () => {
    expect(sanitizeError(new Error("Anthropic timeout"))).toBe("Anthropic timeout");
    expect(sanitizeError("Validation failed")).toBe("Validation failed");
    expect(getDurationMs("2026-08-26T00:00:00.000Z", "2026-08-26T00:00:02.500Z")).toBe(2500);
  });
});
