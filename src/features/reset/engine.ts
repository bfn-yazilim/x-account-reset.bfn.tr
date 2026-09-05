import type { Operation } from "../../types";
import { ApiError, safeError } from "../../lib/x-api/errors";
export async function limitConcurrency<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>,
  stopped: () => boolean = () => false,
) {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error("Concurrency must be a positive integer.");
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (!stopped()) {
        const item = items[cursor++];
        if (item === undefined) return;
        await run(item);
      }
    }),
  );
}
export const totals = (ops: Operation[]) => ({
  total: ops.length,
  completed: ops.filter((o) =>
    ["success", "failed", "skipped"].includes(o.status),
  ).length,
  successful: ops.filter((o) => o.status === "success").length,
  failed: ops.filter((o) => o.status === "failed").length,
  skipped: ops.filter((o) => o.status === "skipped").length,
});
export class ResetEngine {
  private stopped = false;
  private active = false;
  pauseReason = "";
  retryAt = 0;
  constructor(
    public operations: Operation[],
    private execute: (op: Operation) => Promise<void>,
    private changed: () => void,
    private concurrency = 1,
  ) {}
  stop() {
    this.stopped = true;
    this.changed();
  }
  async run() {
    if (this.active) return;
    this.active = true;
    this.stopped = false;
    this.pauseReason = "";
    try {
      await limitConcurrency(
        this.operations.filter((o) => o.status === "pending"),
        this.concurrency,
        async (op) => {
          op.status = "running";
          this.changed();
          try {
            await this.execute(op);
            op.status = "success";
            op.detail = undefined;
          } catch (error) {
            op.status =
              error instanceof ApiError && error.status === 404
                ? "skipped"
                : "failed";
            op.detail = safeError(error);
            if (
              error instanceof ApiError &&
              [0, 401, 403, 429].includes(error.status)
            ) {
              this.stopped = true;
              this.pauseReason = op.detail;
              this.retryAt =
                error.retryAt ??
                (error.status === 429 ? Date.now() + 60000 : 0);
            }
          }
          this.changed();
        },
        () => this.stopped,
      );
    } finally {
      this.active = false;
      this.changed();
    }
  }
}
