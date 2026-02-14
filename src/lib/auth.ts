import { login as apiLogin } from "./api";
import { setToken, clearToken, getToken } from "./token";

export async function login(email: string, password: string) {
  const { token, user } = await apiLogin(email, password);
  await setToken(token);
  return user;
}

export async function logout() {
  await clearToken();
}

export async function getStoredToken() {
  return getToken();
}
