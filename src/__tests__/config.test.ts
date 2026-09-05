import { afterEach, expect, it, vi } from "vitest";
import { getClientId, saveClientId } from "../lib/oauth/config";
import { SessionTokenStorage } from "../lib/storage/tokens";
function memoryStorage(): Storage {
  const data: Record<string, string> = {};
  return new Proxy(
    {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
      removeItem: (k: string) => {
        delete data[k];
      },
    },
    {
      ownKeys: () => Object.keys(data),
      getOwnPropertyDescriptor: () => ({
        enumerable: true,
        configurable: true,
      }),
    },
  ) as unknown as Storage;
}
afterEach(() => vi.unstubAllEnvs());
it("uses the optional build default until the user enters their own ID", () => {
  vi.stubEnv("VITE_X_CLIENT_ID", "build-default");
  const storage = memoryStorage();
  expect(getClientId(storage)).toBe("build-default");
  saveClientId("  my-public-id  ", storage);
  expect(getClientId(storage)).toBe("my-public-id");
  new SessionTokenStorage(storage).clear();
  expect(getClientId(storage)).toBe("build-default");
});
it("supports setup without an environment variable and survives callback reads", () => {
  vi.stubEnv("VITE_X_CLIENT_ID", "");
  const storage = memoryStorage();
  expect(getClientId(storage)).toBe("");
  saveClientId("public-id", storage);
  expect(getClientId(storage)).toBe("public-id");
  new SessionTokenStorage(storage).clear();
  expect(getClientId(storage)).toBe("");
});
it("rejects blank IDs and embedded whitespace", () => {
  const storage = memoryStorage();
  for (const value of ["", "   ", "abc def"])
    expect(() => saveClientId(value, storage)).toThrow();
  expect(getClientId(storage)).not.toBe("abc def");
});
