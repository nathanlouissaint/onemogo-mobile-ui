import * as SecureStore from "expo-secure-store";

type User = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  createdAt: string;
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
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api"; // dev fallback only

const TOKEN_KEY = "auth_token";

let onUnauthorized: (() => void) | null = null;
/** Optional: app can register a handler to redirect to login, clear state, etc. */
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

    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

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

// Convenience wrappers to avoid the requireAuth footgun
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
  }>("/auth/login", {
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
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  return data.user;
}

/**
 * SESSION
 */
export async function getMe(): Promise<User> {
  const data = await requestAuth<{ user: User }>("/me");
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
  const data = await requestAuth<{ user: User }>("/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return data.user;
}

/**
 * LOGOUT
 */
export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  onUnauthorized?.();
}
