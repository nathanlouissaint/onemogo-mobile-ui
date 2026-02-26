// src/session/SessionContext.tsx
import { router, useSegments } from "expo-router";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as api from "../lib/supabase";

type SessionState = {
  user: api.User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<api.User>;
  register: (payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }) => Promise<api.User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

function isOnboardingComplete(user: api.User | null) {
  return Boolean((user as any)?.onboardingCompletedAt);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const segments = useSegments();

  const [user, setUser] = useState<api.User | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevent redirect thrash (replace loops / fast refresh / segment churn)
  const lastRouteRef = useRef<string>("");

  useEffect(() => {
    api.setOnUnauthorized(() => {
      setUser(null);
    });

    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🚫 DO NOT ROUTE INSIDE refresh()
  async function refresh() {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  }

  async function login(email: string, password: string) {
    const u = await api.login(email, password);
    setUser(u);
    return u;
  }

  async function register(payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }) {
    const u = await api.register(payload);
    setUser(u);
    return u;
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  // ✅ Centralized routing guard
  // IMPORTANT: You should NOT keep an additional routing guard in app/_layout.tsx.
  // Having both will cause loops/bounces.
  useEffect(() => {
    if (loading) return;

    const seg0 = segments[0] ?? "";
    const inAuth = seg0 === "login" || seg0 === "register";
    const inOnboarding = seg0 === "onboarding";
    const onboardingDone = isOnboardingComplete(user);

    // Compute destination based on state
    let next: string | null = null;

    if (!user) {
      if (!inAuth) next = "/login";
    } else if (!onboardingDone) {
      if (!inOnboarding) next = "/onboarding/goal";
    } else {
      if (inAuth || inOnboarding) next = "/(tabs)";
    }

    if (!next) return;

    // Dedupe: avoid repeated replaces to the same target (segment churn can re-run effect)
    if (lastRouteRef.current === next) return;
    lastRouteRef.current = next;

    router.replace(next);
  }, [user, loading, segments]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}