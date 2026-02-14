import * as SecureStore from "expo-secure-store";

const API_BASE_URL = "http://localhost:4000/api"; 
// Use LAN IP only for physical device testing

async function request<T>(
  path: string,
  options: RequestInit = {},
  requireAuth = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (requireAuth) {
    const token = await SecureStore.getItemAsync("auth_token");
    if (!token) throw new Error("Not authenticated");
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    // If token invalid/expired, auto-clear
    if (res.status === 401) {
      await SecureStore.deleteItemAsync("auth_token");
      throw new Error("Session expired. Please log in again.");
    }

    throw new Error(data?.error || "Request failed");
  }

  return data as T;
}

/**
 * AUTH
 */
export async function login(email: string, password: string) {
  const data = await request<{
    token: string;
    user: {
      id: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      username?: string | null;
      createdAt: string;
    };
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  await SecureStore.setItemAsync("auth_token", data.token);

  return data.user;
}

/**
 * SESSION
 */
export async function getMe() {
  const data = await request<{ user: any }>("/me", {}, true);
  return data.user;
}

/**
 * PROFILE
 */
export async function updateProfile(payload: {
  firstName?: string;
  lastName?: string;
  username?: string;
}) {
  const data = await request<{ user: any }>(
    "/me",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true
  );

  return data.user;
}

/**
 * LOGOUT
 */
export async function logout() {
  await SecureStore.deleteItemAsync("auth_token");
}
