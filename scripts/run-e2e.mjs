import { spawn } from "node:child_process";
import process from "node:process";

const baseURL = "http://127.0.0.1:3000";
const e2eEnv = {
  ...process.env,
  E2E_USE_MOCK_DATA: "true",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-key",
  ANTHROPIC_API_KEY: "e2e-anthropic-key",
  INNGEST_EVENT_KEY: "e2e-inngest-event-key",
  INNGEST_SIGNING_KEY: "e2e-inngest-signing-key"
};

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", "3000"],
  {
    stdio: "inherit",
    env: e2eEnv
  }
);

async function waitForServer() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/dashboard`);

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Next finishes compiling.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }

  throw new Error("Timed out waiting for the Next.js E2E server.");
}

function stopServer() {
  if (!server.pid || server.killed) {
    return Promise.resolve();
  }

  if (process.platform !== "win32") {
    server.kill("SIGTERM");
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore"
    });
    killer.on("exit", resolve);
  });
}

async function runPlaywright() {
  const testProcess = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test"],
    {
      stdio: "inherit",
      env: e2eEnv
    }
  );

  return new Promise((resolve) => {
    testProcess.on("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}

let exitCode = 1;

try {
  await waitForServer();
  exitCode = await runPlaywright();
} finally {
  await stopServer();
}

process.exit(exitCode);
