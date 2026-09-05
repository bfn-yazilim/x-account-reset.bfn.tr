import type { Operation, Page, Post, User } from "../../types";
import { ApiError, delay, parseApiError } from "./errors";
export class XApiClient {
  private user?: User;
  private owned = new Set<string>();
  constructor(private token: () => string | null) {}
  private async request<T>(
    path: string,
    method = "GET",
    signal?: AbortSignal,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      signal?.throwIfAborted();
      const token = this.token();
      if (!token) throw new ApiError(401);
      try {
        const timeout = AbortSignal.timeout(20000);
        const response = await fetch("https://api.x.com/2" + path, {
          method,
          headers: { Authorization: "Bearer " + token },
          credentials: "omit",
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        if (!response.ok) throw parseApiError(response);
        const data = (await response.json()) as T & { errors?: unknown[] };
        if (data.errors?.length) throw new ApiError(400);
        return data;
      } catch (error) {
        signal?.throwIfAborted();
        const parsed = error instanceof ApiError ? error : new ApiError(0);
        // Only reads are automatically retried. An ambiguous write is always reviewed by the user.
        if (
          method !== "GET" ||
          attempt >= 2 ||
          !(parsed.status === 0 || parsed.status >= 500)
        )
          throw parsed;
        await delay(500 * 2 ** attempt, signal);
      }
    }
  }
  async getCurrentUser(signal?: AbortSignal) {
    const result = await this.request<{ data: User }>(
      "/users/me?user.fields=profile_image_url",
      "GET",
      signal,
    );
    if (!result.data?.id) throw new ApiError(400);
    this.user = result.data;
    return result.data;
  }
  private get id() {
    if (!this.user) throw new ApiError(401);
    return this.user.id;
  }
  private query(token?: string) {
    return token ? "&pagination_token=" + encodeURIComponent(token) : "";
  }
  async getUserPosts(
    token?: string,
    signal?: AbortSignal,
  ): Promise<Page<Post>> {
    const page = await this.request<Page<Post>>(
      `/users/${this.id}/tweets?max_results=100&tweet.fields=author_id,referenced_tweets${this.query(token)}`,
      "GET",
      signal,
    );
    for (const post of page.data ?? [])
      if (post.author_id === this.id) this.owned.add(post.id);
    return page;
  }
  getLikedPosts(token?: string, signal?: AbortSignal) {
    return this.request<Page<Post>>(
      `/users/${this.id}/liked_tweets?max_results=100${this.query(token)}`,
      "GET",
      signal,
    );
  }
  getFollowing(token?: string, signal?: AbortSignal) {
    return this.request<Page<User>>(
      `/users/${this.id}/following?max_results=1000${this.query(token)}`,
      "GET",
      signal,
    );
  }
  private async mutate(path: string, key: string) {
    const result = await this.request<{ data?: Record<string, boolean> }>(
      path,
      "DELETE",
    );
    if (result.data?.[key] !== (key === "deleted")) throw new ApiError(400);
  }
  deletePost(id: string) {
    if (!this.owned.has(id))
      throw new Error("Post ownership was not verified. Rescan first.");
    return this.mutate("/tweets/" + encodeURIComponent(id), "deleted");
  }
  unlikePost(id: string) {
    return this.mutate(
      `/users/${this.id}/likes/${encodeURIComponent(id)}`,
      "liked",
    );
  }
  unfollowUser(id: string) {
    return this.mutate(
      `/users/${this.id}/following/${encodeURIComponent(id)}`,
      "following",
    );
  }
  undoRepost(id: string) {
    return this.mutate(
      `/users/${this.id}/retweets/${encodeURIComponent(id)}`,
      "retweeted",
    );
  }
  execute(operation: Operation) {
    switch (operation.category) {
      case "likes":
        return this.unlikePost(operation.target);
      case "following":
        return this.unfollowUser(operation.target);
      case "reposts":
        return this.undoRepost(operation.target);
      default:
        return this.deletePost(operation.target);
    }
  }
}
// A real browser performs the CORS preflight for these harmless OPTIONS requests.
// This is conservative: a failed probe disables the operation, even if X might accept a write.
export async function probeBrowserAccess(
  path = "/oauth2/token",
  signal?: AbortSignal,
) {
  try {
    await fetch("https://api.x.com/2" + path, {
      method: "OPTIONS",
      headers: { Authorization: "Bearer cors-capability-probe" },
      credentials: "omit",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    });
    // Any HTTP response means the browser reached X and CORS did not hard-fail.
    // We intentionally do not require a 2xx status because unauthenticated
    // probe requests may return 4xx even when real authenticated calls are possible.
    return true;
  } catch {
    return false;
  }
}
