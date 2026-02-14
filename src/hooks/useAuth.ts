import { useEffect, useState } from "react";
import * as auth from "../lib/auth";

type User = {
  id: string;
  email: string;
  createdAt: string;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const token = await auth.getStoredToken();
      if (token) {
        // Later you’ll verify token with backend
        console.log("Found stored token");
      }
    } catch (err) {
      console.log("Bootstrap error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const loggedInUser = await auth.login(email, password);
    setUser(loggedInUser);
  }

  async function logout() {
    await auth.logout();
    setUser(null);
  }

  return {
    user,
    loading,
    login,
    logout,
  };
}
