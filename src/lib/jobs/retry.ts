export const defaultMaxAttempts = 3;
export const initialBackoffSeconds = 30;
export const maxBackoffSeconds = 300;

export function getBackoffDelaySeconds(attempt: number) {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(maxBackoffSeconds, initialBackoffSeconds * 2 ** (normalizedAttempt - 1));
}

export function shouldRetryAttempt(attempt: number, maxAttempts = defaultMaxAttempts) {
  return attempt < maxAttempts;
}

export function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown background processing error.";
}

export function getDurationMs(startedAt: string | Date, completedAt: string | Date) {
  const started = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const completed = completedAt instanceof Date ? completedAt : new Date(completedAt);
  return Math.max(0, completed.getTime() - started.getTime());
}
