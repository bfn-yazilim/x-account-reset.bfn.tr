import { describe, it, expect, vi } from "vitest";
import { challengeFor, createPkce, validateState } from "../lib/oauth/pkce";
import { SessionTokenStorage } from "../lib/storage/tokens";
import { paginateXApi } from "../lib/x-api/pagination";
import { ApiError, parseApiError } from "../lib/x-api/errors";
import {
  classify,
  confirmed,
  postOperation,
  selectOperations,
} from "../features/reset/selection";
import {
  limitConcurrency,
  ResetEngine,
  totals,
} from "../features/reset/engine";
import { XApiClient } from "../lib/x-api/client";
import type { Operation } from "../types";
const op = (id: string): Operation => ({
  id,
  target: id,
  category: "posts",
  status: "pending",
});
describe("OAuth", () => {
  it("matches the RFC 7636 S256 vector", async () =>
    expect(
      await challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"));
  it("uses independent URL-safe random values", async () => {
    const a = await createPkce(),
      b = await createPkce();
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.state).not.toBe(a.verifier);
    expect(a.state).not.toBe(b.state);
  });
  it("rejects missing or unequal states", () => {
    for (const [a, b] of [
      [null, null],
      ["a", null],
      ["a", "A"],
    ])
      expect(() => validateState(a ?? null, b ?? null)).toThrow();
    expect(() => validateState("a", "a")).not.toThrow();
  });
  it("stores, expires and clears only project session data", () => {
    const data: Record<string, string> = { unrelated: "keep" };
    const storage = {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
      removeItem: (k: string) => {
        delete data[k];
      },
    };
    const proxy = new Proxy(storage, {
      ownKeys: () => Object.keys(data),
      getOwnPropertyDescriptor: () => ({
        enumerable: true,
        configurable: true,
      }),
    }) as unknown as Storage;
    const tokens = new SessionTokenStorage(proxy);
    tokens.setTokens({
      access_token: "example",
      expires_at: Date.now() + 1000,
    });
    expect(tokens.getAccessToken()).toBe("example");
    tokens.setTokens({ access_token: "old", expires_at: 0 });
    expect(tokens.getAccessToken()).toBeNull();
    tokens.clear();
    expect(data).toEqual({ unrelated: "keep" });
  });
});
describe("pagination and errors", () => {
  it("follows every cursor", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ data: [1], meta: { next_token: "next" } })
      .mockResolvedValueOnce({ data: [2] });
    const found: number[] = [];
    for await (const page of paginateXApi<number>(fetch)) found.push(...page);
    expect(found).toEqual([1, 2]);
    expect(fetch).toHaveBeenLastCalledWith("next");
  });
  it("rejects repeated cursors and partial errors", async () => {
    async function drain(partial = false) {
      for await (const page of paginateXApi(async () =>
        partial
          ? { errors: [{}] }
          : { data: [], meta: { next_token: "repeat" } },
      ))
        void page;
    }
    await expect(drain()).rejects.toThrow("repeated");
    await expect(drain(true)).rejects.toThrow("incomplete");
  });
  it("parses rate limits without exposing response bodies", () => {
    const e = parseApiError(
      new Response("secret", {
        status: 429,
        headers: { "x-rate-limit-reset": "2000000000" },
      }),
    );
    expect(e.retryAt).toBe(2000000000000);
    expect(e.message).not.toContain("secret");
    for (const status of [400, 401, 403, 404, 500])
      expect(new ApiError(status).message).toBeTruthy();
  });
});
describe("selection", () => {
  it("separates repost, reply, quote and original posts", () => {
    expect(classify({ id: "1", text: "" })).toBe("posts");
    for (const [type, category] of [
      ["replied_to", "replies"],
      ["quoted", "quotes"],
      ["retweeted", "reposts"],
    ] as const) {
      const p = { id: "1", text: "", referenced_tweets: [{ type, id: "2" }] };
      expect(classify(p)).toBe(category);
      expect(postOperation(p).target).toBe(type === "retweeted" ? "2" : "1");
    }
  });
  it("deduplicates and requires exact confirmation", () => {
    expect(selectOperations([op("1"), op("1")], ["posts"])).toHaveLength(1);
    expect(selectOperations([op("1")], [])).toEqual([]);
    expect(confirmed("RESET")).toBe(true);
    for (const s of ["reset", " RESET", "RESET "])
      expect(confirmed(s)).toBe(false);
  });
});
describe("reset engine", () => {
  it("bounds concurrent work", async () => {
    let active = 0,
      max = 0;
    await limitConcurrency([1, 2, 3, 4], 2, async () => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 3));
      active--;
    });
    expect(max).toBe(2);
  });
  it("does not start requests after stop", async () => {
    const run = vi.fn(async () => {
      engine.stop();
    });
    const engine = new ResetEngine([op("1"), op("2")], run, () => {});
    await engine.run();
    expect(run).toHaveBeenCalledTimes(1);
    expect(engine.operations[1]?.status).toBe("pending");
    expect(totals(engine.operations).successful).toBe(1);
  });
  it("pauses on 429 and never automatically retries a write", async () => {
    const run = vi.fn(async () => {
      throw new ApiError(429);
    });
    const engine = new ResetEngine([op("1"), op("2")], run, () => {});
    await engine.run();
    expect(run).toHaveBeenCalledTimes(1);
    expect(totals(engine.operations).failed).toBe(1);
    expect(engine.operations[1]?.status).toBe("pending");
    expect(engine.retryAt).toBeGreaterThan(Date.now());
  });
  it("skips unavailable items and continues", async () => {
    const e = new ResetEngine(
      [op("1"), op("2")],
      async (o) => {
        if (o.id === "1") throw new ApiError(404);
      },
      () => {},
    );
    await e.run();
    expect(totals(e.operations)).toMatchObject({
      skipped: 1,
      successful: 1,
      completed: 2,
    });
  });
  it("refuses deletion without verified ownership", () => {
    const api = new XApiClient(() => "example");
    expect(() => api.deletePost("123")).toThrow("ownership");
  });
});
