export class ApiError extends Error {
  constructor(
    public status: number,
    public retryAt?: number,
  ) {
    super(
      (
        {
          0: "X is unreachable from this browser. CORS, network, or timeout may be blocking access.",
          400: "X rejected this request.",
          401: "Your session expired. Disconnect and reconnect.",
          403: "X denied access. Check app permissions and API access.",
          404: "This item is unavailable or no longer exists.",
          429: "X rate limit reached. The queue is paused.",
        } as Record<number, string>
      )[status] ??
        (status >= 500
          ? "X is temporarily unavailable."
          : "X returned an unexpected response."),
    );
  }
}
export function parseApiError(response: Response) {
  const reset = Number(response.headers.get("x-rate-limit-reset"));
  const retry = response.headers.get("retry-after");
  const retryAt = retry
    ? /^\d+$/.test(retry)
      ? Date.now() + Number(retry) * 1000
      : Date.parse(retry)
    : reset > 0
      ? reset * 1000
      : undefined;
  return new ApiError(
    response.status,
    retryAt && Number.isFinite(retryAt) ? retryAt : undefined,
  );
}
export const safeError = (error: unknown) =>
  error instanceof ApiError
    ? error.message +
      (error.retryAt
        ? " Retry after " + new Date(error.retryAt).toLocaleTimeString() + "."
        : "")
    : "The operation could not be completed. Please try again.";
export async function delay(ms: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
