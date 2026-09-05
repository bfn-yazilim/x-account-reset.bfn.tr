import { PREFIX } from "../storage/tokens";
export function getClientId(storage: Storage = sessionStorage): string {
  return (
    storage.getItem(PREFIX + "client-id") ??
    import.meta.env.VITE_X_CLIENT_ID ??
    ""
  );
}
export function saveClientId(
  value: string,
  storage: Storage = sessionStorage,
): void {
  const clientId = value.trim();
  if (!clientId || /\s/.test(clientId))
    throw new Error("Enter a valid public X OAuth Client ID (without spaces).");
  storage.setItem(PREFIX + "client-id", clientId);
}
export function getRedirectUri(): string {
  return import.meta.env.VITE_X_REDIRECT_URI || location.origin + "/callback/";
}
