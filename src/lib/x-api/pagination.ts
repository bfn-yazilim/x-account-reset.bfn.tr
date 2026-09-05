import type { Page } from "../../types";
export async function* paginateXApi<T>(
  fetchPage: (token?: string) => Promise<Page<T>>,
  signal?: AbortSignal,
) {
  let token: string | undefined;
  const seen = new Set<string>();
  do {
    signal?.throwIfAborted();
    const page = await fetchPage(token);
    if (page.errors?.length)
      throw new Error(
        "X returned incomplete results. Rescan before proceeding.",
      );
    yield page.data ?? [];
    token = page.meta?.next_token;
    if (token && seen.has(token))
      throw new Error("X repeated a pagination cursor. Scan stopped.");
    if (token) seen.add(token);
  } while (token);
}
