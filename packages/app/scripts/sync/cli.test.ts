import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";

const Cli = path.join(import.meta.dirname, "index.ts");

// These cases all exit before touching the database or CFBD
const runCli = (...args: string[]) =>
  new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [Cli, ...args], {
      env: {
        ...process.env,
        DATABASE_URL: "postgres://unused@localhost:1/unused",
        CFBD_API_KEY: "unused",
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });

describe.concurrent("sync CLI", () => {
  it("prints usage with --help", async () => {
    const { status, stdout } = await runCli("--help");
    expect(status).toBe(0);
    expect(stdout).toMatch(
      /Usage: node scripts\/sync\/index\.ts \[conferences\|teams\|games\|lines/,
    );
  });

  it("rejects unknown tables", async () => {
    const { status, stderr } = await runCli("teams", "bogus");
    expect(status).toBe(1);
    expect(stderr).toMatch(/Unknown table\(s\): bogus/);
  });

  it("rejects unknown options", async () => {
    const { status, stderr } = await runCli("--nope");
    expect(status).toBe(1);
    expect(stderr).toMatch(/Unknown option '--nope'/);
  });

  it.each([
    ["--concurrency", "0"],
    ["--interval", "-1"],
    ["--year", "abc"],
  ])("rejects invalid %s %s", async (flag, value) => {
    const { status, stderr } = await runCli(`${flag}=${value}`);
    expect(status).toBe(1);
    expect(stderr).toContain(`Invalid ${flag}: ${value}`);
  });
});
