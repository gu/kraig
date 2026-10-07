import { describe, expect, it } from "vitest";
import { setTimeout as sleep } from "node:timers/promises";
import { createThrottle } from "./throttle.ts";

describe("createThrottle", () => {
  it("never runs more than `concurrency` tasks at once", async () => {
    const throttle = createThrottle({ concurrency: 2, intervalMs: 0 });
    let active = 0;
    let maxActive = 0;

    await Promise.all(
      Array.from({ length: 6 }, () =>
        throttle(async () => {
          active++;
          maxActive = Math.max(maxActive, active);
          await sleep(20);
          active--;
        }),
      ),
    );

    expect(maxActive).toBe(2);
  });

  it("spaces task starts at least `intervalMs` apart", async () => {
    const throttle = createThrottle({ concurrency: 10, intervalMs: 50 });
    const starts: number[] = [];

    await Promise.all(
      Array.from({ length: 4 }, () => throttle(async () => starts.push(Date.now()))),
    );

    const gaps = starts.slice(1).map((start, i) => start - starts[i]);
    // Small tolerance for timer granularity
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(45);
  });

  it("returns each task's result", async () => {
    const throttle = createThrottle({ concurrency: 2, intervalMs: 0 });
    const results = await Promise.all([1, 2, 3].map((n) => throttle(async () => n * 10)));
    expect(results).toEqual([10, 20, 30]);
  });

  it("frees the slot when a task fails", async () => {
    const throttle = createThrottle({ concurrency: 1, intervalMs: 0 });

    await expect(
      throttle(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await throttle(async () => "next")).toBe("next");
  });
});
