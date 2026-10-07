import { setTimeout as sleep } from "node:timers/promises";

export type Throttle = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Limits how many tasks run at once and enforces a minimum gap between task starts.
 */
export function createThrottle({
  concurrency,
  intervalMs,
}: {
  concurrency: number;
  intervalMs: number;
}): Throttle {
  let active = 0;
  let nextStartAt = 0;
  const waiting: (() => void)[] = [];

  const acquire = async () => {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active++;

    // Reserve a start slot so concurrent callers stay spaced out
    const now = Date.now();
    const startAt = Math.max(now, nextStartAt);
    nextStartAt = startAt + intervalMs;
    if (startAt > now) await sleep(startAt - now);
  };

  const release = () => {
    active--;
    waiting.shift()?.();
  };

  return async (fn) => {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };
}
