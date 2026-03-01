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
import { supabase } from "../lib/supabase";

export type User = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  onboardingCompletedAt?: string | null;
};

type SessionState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

function mapSupabaseUser(u: any): User {
  const md = u?.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email,
    firstName: md.firstName,
    lastName: md.lastName,
    username: md.username,
    onboardingCompletedAt: md.onboardingCompletedAt ?? null,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const segments = useSegments();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const lastRouteRef = useRef<string>("");

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(data.session?.user ? mapSupabaseUser(data.session.user) : null);
      setLoading(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      lastRouteRef.current = "";
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refresh() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setUser(null);
      return;
    }
    setUser(data.session?.user ? mapSupabaseUser(data.session.user) : null);
  }

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    const mapped = data.user ? mapSupabaseUser(data.user) : null;
    if (!mapped) throw new Error("Login succeeded but no user returned.");
    setUser(mapped);
    return mapped;
  }

  async function register(payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }) {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          username: payload.username,
          onboardingCompletedAt: null,
        },
      },
    });

    if (error) throw error;

    if (data.session?.user) {
      const mapped = mapSupabaseUser(data.session.user);
      setUser(mapped);
      return mapped;
    }

    const mapped = data.user ? mapSupabaseUser(data.user) : null;
    if (!mapped) throw new Error("Signup succeeded but no user returned.");
    return mapped;
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  // Centralized routing guard: auth vs app tabs (NO onboarding until route exists)
  useEffect(() => {
    if (loading) return;

    const seg0 = segments[0];
    const inAuth =
      seg0 === "(auth)" || seg0 === "login" || seg0 === "register";
    const inTabs = seg0 === "(tabs)";

    let next: string | null = null;

    if (!user) {
      if (!inAuth) next = "/login";
    } else {
      if (!inTabs && inAuth) next = "/(tabs)";
      // If authed and not in auth, do nothing—let user stay where they are.
      // (prevents stomping deep links like /workout/[id])
    }

    if (!next) return;
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