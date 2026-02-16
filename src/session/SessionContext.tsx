import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import * as SecureStore from "expo-secure-store";
import { getMe, logout as apiLogout } from "../lib/api";

export type User = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  createdAt: string;
};

type SessionState = {
  user: User | null;
  loading: boolean;
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

const TOKEN_KEY = "auth_token";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate session on boot
  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);

      if (!token) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const me = await getMe();
        if (mounted) setUser(me);
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = (u: User) => {
    setUser(u);
  };

  const signOut = async () => {
    await apiLogout();
    setUser(null);
  };

  const refresh = async () => {
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signOut,
      refresh,
    }),
    [user, loading]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
