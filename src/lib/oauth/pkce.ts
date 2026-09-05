import { PREFIX, SessionTokenStorage } from "../storage/tokens";
export const SCOPES = [
  "tweet.read",
  "users.read",
  "tweet.write",
  "like.read",
  "like.write",
  "follows.read",
  "follows.write",
];
export const AUTH_URL = "https://x.com/i/oauth2/authorize";
export const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export const secureRandom = () =>
  base64url(crypto.getRandomValues(new Uint8Array(32)));
export async function challengeFor(verifier: string) {
  return base64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
}
export async function createPkce() {
  const verifier = secureRandom();
  return {
    verifier,
    challenge: await challengeFor(verifier),
    state: secureRandom(),
  };
}
export function validateState(
  expected: string | null,
  received: string | null,
) {
  if (!expected || !received || expected !== received)
    throw new Error(
      "OAuth state verification failed. Connect again from this tab.",
    );
}
export function config() {
  const clientId = import.meta.env.VITE_X_CLIENT_ID as string | undefined;
  const redirect =
    (import.meta.env.VITE_X_REDIRECT_URI as string | undefined) ||
    location.origin + "/callback/";
  if (!clientId)
    throw new Error(
      "Connection is not configured. Set the public VITE_X_CLIENT_ID and rebuild the site.",
    );
  const url = new URL(redirect);
  if (
    url.origin !== location.origin ||
    url.hash ||
    url.search ||
    !["/callback", "/callback/", "/"].includes(url.pathname)
  )
    throw new Error(
      "The callback must use this origin and /callback/ (or /). Open the configured origin before connecting.",
    );
  return { clientId, redirect };
}
export async function connect() {
  const { clientId, redirect } = config();
  const pkce = await createPkce();
  sessionStorage.setItem(
    PREFIX + "oauth",
    JSON.stringify({
      state: pkce.state,
      verifier: pkce.verifier,
      created: Date.now(),
      redirect,
    }),
  );
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirect,
    scope: SCOPES.join(" "),
    state: pkce.state,
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
  }).toString();
  location.assign(url);
}
// Consume state once, scrub the URL before network activity, and never expose raw OAuth responses.
export async function finishOAuth() {
  const query = new URLSearchParams(location.search);
  if (!query.has("code") && !query.has("error")) return;
  history.replaceState(null, "", location.pathname);
  const raw = sessionStorage.getItem(PREFIX + "oauth");
  sessionStorage.removeItem(PREFIX + "oauth");
  let saved: {
    state?: string;
    verifier?: string;
    created?: number;
    redirect?: string;
  } = {};
  try {
    saved = JSON.parse(raw ?? "{}") as typeof saved;
  } catch {
    throw new Error("OAuth session is invalid. Connect again.");
  }
  validateState(saved?.state ?? null, query.get("state"));
  if (query.has("error"))
    throw new Error("X authorization was declined or could not be completed.");
  if (!saved.verifier || !saved.created || Date.now() - saved.created > 600000)
    throw new Error("OAuth session expired. Connect again.");
  const { clientId, redirect } = config();
  if (redirect !== saved.redirect)
    throw new Error("OAuth callback configuration changed. Connect again.");
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirect,
        code: query.get("code") ?? "",
        code_verifier: saved.verifier,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      "X token exchange is unreachable from this browser (CORS, network, or timeout). Connection is unavailable. No proxy is used.",
    );
  }
  if (!response.ok)
    throw new Error(
      "X rejected the token exchange. Check the public app configuration and connect again.",
    );
  const data = (await response.json().catch(() => {
    throw new Error("X returned an invalid token response.");
  })) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  if (
    !data ||
    typeof data.access_token !== "string" ||
    !data.access_token ||
    typeof data.expires_in !== "number" ||
    typeof data.token_type !== "string" ||
    data.token_type.toLowerCase() !== "bearer"
  )
    throw new Error("X returned an invalid token response.");
  new SessionTokenStorage(sessionStorage).setTokens({
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });
}
