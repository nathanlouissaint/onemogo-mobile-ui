// src/hooks/useAuth.ts
import { useEffect, useState } from "react";
import * as api from "../lib/api";

export type User = api.User;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.setOnUnauthorized(() => {
      setUser(null);
    });

    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const loggedInUser = await api.login(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  }

  async function register(payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }) {
    const newUser = await api.register(payload);
    setUser(newUser);
    return newUser;
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return { user, loading, login, register, logout };
}
