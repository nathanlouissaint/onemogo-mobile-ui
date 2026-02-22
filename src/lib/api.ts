// src/lib/api.ts
import * as SecureStore from "expo-secure-store";

export type User = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  createdAt: string;

  // Onboarding fields
  onboardingCompletedAt?: string | null;
  goal?: string | null;
  trainingDaysPerWeek?: number | null;
  strengthTrackingMode?: string | null;
  experienceLevel?: string | null;
  baselineWeight?: number | null;
};

type ApiErrorShape = {
  status: number;
  message: string;
  path: string;
  code?: string;
  details?: unknown;
  raw?: string;
};

export class ApiError extends Error implements ApiErrorShape {
  status: number;
  path: string;
  code?: string;
  details?: unknown;
  raw?: string;

  constructor(e: ApiErrorShape) {
    super(e.message);
    this.name = "ApiError";
    this.status = e.status;
    this.path = e.path;
    this.code = e.code;
    this.details = e.details;
    this.raw = e.raw;
  }
}

// Prefer env configuration (Expo: EXPO_PUBLIC_* variables)
// IMPORTANT: localhost will NOT work on a physical device. Set EXPO_PUBLIC_API_URL to your LAN IP.
const RAW_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

// Normalize (avoid trailing slash causing //auth/login)
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");

if (API_BASE_URL.includes("localhost")) {
  console.warn(
    "[api] API_BASE_URL is set to localhost. This will fail on a physical device. Set EXPO_PUBLIC_API_URL (e.g., http://192.168.x.x:4000)."
  );
}

const TOKEN_KEY = "auth_token";

let onUnauthorized: (() => void) | null = null;
/** Optional: app can register a handler to clear state, redirect, etc. */
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function safeParseBody(
  res: Response
): Promise<{
  data: any;
  raw: string;
}> {
  const raw = await res.text();
  if (!raw) return { data: null, raw: "" };

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return { data: JSON.parse(raw), raw };
    } catch {
      return { data: null, raw };
    }
  }

  return { data: null, raw };
}

async function request<T>(args: {
  path: string;
  options?: RequestInit;
  requireAuth?: boolean;
  timeoutMs?: number;
}): Promise<T> {
  const { path, options = {}, requireAuth = false, timeoutMs = 15000 } = args;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const hasBody = typeof options.body !== "undefined" && options.body !== null;
    const bodyIsString = typeof options.body === "string";
    const callerSetContentType = Object.keys(headers).some(
      (k) => k.toLowerCase() === "content-type"
    );

    if (hasBody && bodyIsString && !callerSetContentType) {
      headers["Content-Type"] = "application/json";
    }

    if (requireAuth) {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        throw new ApiError({
          status: 401,
          message: "Not authenticated",
          path,
        });
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}${path}`;
    console.log("[api] =>", options.method ?? "GET", url);
    console.log("[api] FETCH START", url);

    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    console.log("[api] FETCH DONE", url, res.status);

    const { data, raw } = await safeParseBody(res);

    if (!res.ok) {
      if (res.status === 401) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        onUnauthorized?.();
      }

      const message =
        (data && (data.error || data.message)) ||
        (raw ? `Request failed: ${raw.slice(0, 200)}` : "Request failed");

      throw new ApiError({
        status: res.status,
        message,
        path,
        details: data ?? undefined,
        raw: raw || undefined,
      });
    }

    return data as T;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new ApiError({
        status: 0,
        message: `Request timeout after ${timeoutMs}ms`,
        path,
      });
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// Convenience wrappers
const requestPublic = <T>(path: string, options?: RequestInit) =>
  request<T>({ path, options, requireAuth: false });

const requestAuth = <T>(path: string, options?: RequestInit) =>
  request<T>({ path, options, requireAuth: true });

/**
 * AUTH
 */
export async function login(email: string, password: string): Promise<User> {
  const data = await requestPublic<{
    token: string;
    user: User;
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  return data.user;
}

export async function register(payload: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}): Promise<User> {
  const data = await requestPublic<{
    token: string;
    user: User;
  }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  return data.user;
}

/**
 * ONBOARDING
 */
export async function submitOnboarding(payload: {
  goal: string;
  trainingDaysPerWeek: number;
  strengthTrackingMode: "prs" | "volume" | "both";
  experienceLevel: "beginner" | "intermediate" | "advanced";
  baselineWeight: number;
}): Promise<User> {
  const data = await requestAuth<{ user: User }>("/api/onboarding", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data.user;
}

/**
 * SESSION
 */
export async function getMe(): Promise<User> {
  const data = await requestAuth<{ user: User }>("/api/me");
  return data.user;
}

/**
 * PROFILE
 */
export async function updateProfile(payload: {
  firstName?: string;
  lastName?: string;
  username?: string;
}): Promise<User> {
  const data = await requestAuth<{ user: User }>("/api/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return data.user;
}

/**
 * WORKOUT SESSIONS
 */
export type WorkoutSession = {
  id: string;
  userId?: string;
  activityType?: "LIFTING" | "CYCLING" | "SWIMMING" | string;
  title?: string | null;
  durationMin?: number | null;
  metrics?: any;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function getWorkouts(): Promise<WorkoutSession[]> {
  const data = await requestAuth<any>("/api/workout-sessions");

  if (Array.isArray(data?.sessions)) return data.sessions as WorkoutSession[];
  if (Array.isArray(data)) return data as WorkoutSession[];
  return [];
}

export async function getWorkout(id: string): Promise<WorkoutSession> {
  const data = await requestAuth<any>(
    `/api/workout-sessions/${encodeURIComponent(id)}`
  );
  if (data?.session) return data.session as WorkoutSession;
  return data as WorkoutSession;
}

/**
 * COMPLETE WORKOUT
 * Backend does not implement this route yet. Keep this as a hard fail so it’s obvious.
 */
export async function completeWorkout(id: string) {
  throw new ApiError({
    status: 0,
    message:
      "Not implemented: backend has no /workout-sessions/:id/complete endpoint",
    path: `/api/workout-sessions/${id}/complete`,
  });
}

/**
 * LOGOUT
 */
export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}