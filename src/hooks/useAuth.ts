// src/hooks/useAuth.ts
import { useSession } from "../session/SessionContext";

export type User = ReturnType<typeof useSession>["user"] extends infer U ? U : never;

export function useAuth() {
  const { user, loading, login, register, logout } = useSession();
  return { user, loading, login, register, logout };
}