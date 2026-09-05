import { useEffect, useState } from "react";
import { finishOAuth } from "../../lib/oauth/pkce";
import { SessionTokenStorage } from "../../lib/storage/tokens";
import { XApiClient } from "../../lib/x-api/client";
import type { User } from "../../types";
import { safeError } from "../../lib/x-api/errors";
let startup: Promise<void> | undefined;
export function useAuth() {
  const [storage] = useState(() => new SessionTokenStorage(sessionStorage));
  const [client] = useState(
    () => new XApiClient(() => storage.getAccessToken()),
  );
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    startup ??= finishOAuth();
    void startup
      .then(async () => {
        if (storage.getAccessToken()) {
          const user = await client.getCurrentUser();
          if (mounted) setUser(user);
        }
      })
      .catch((error: unknown) => {
        if (mounted)
          setError(
            error instanceof Error && !(error.name === "ApiError")
              ? error.message
              : safeError(error),
          );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [client, storage]);
  const disconnect = () => {
    storage.clear();
    setUser(undefined);
    setError("");
    history.replaceState(null, "", "/");
    location.reload();
  };
  return { user, client, loading, error, setError, disconnect };
}
