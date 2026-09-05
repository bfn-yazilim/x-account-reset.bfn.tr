export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}
export interface TokenStorage {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(tokens: OAuthTokens): void;
  clear(): void;
}
export const PREFIX = "x-reset:";
export class SessionTokenStorage implements TokenStorage {
  constructor(private storage: Storage) {}
  private read(): OAuthTokens | null {
    try {
      const value: unknown = JSON.parse(
        this.storage.getItem(PREFIX + "tokens") ?? "null",
      );
      if (
        !value ||
        typeof value !== "object" ||
        !("access_token" in value) ||
        typeof value.access_token !== "string" ||
        !("expires_at" in value) ||
        typeof value.expires_at !== "number"
      )
        return null;
      return value as OAuthTokens;
    } catch {
      return null;
    }
  }
  getAccessToken() {
    const t = this.read();
    return t && t.expires_at > Date.now() ? t.access_token : null;
  }
  getRefreshToken() {
    return this.read()?.refresh_token ?? null;
  }
  setTokens(tokens: OAuthTokens) {
    this.storage.setItem(PREFIX + "tokens", JSON.stringify(tokens));
  }
  clear() {
    for (const key of Object.keys(this.storage))
      if (key.startsWith(PREFIX)) this.storage.removeItem(key);
  }
}
