import * as SecureStore from "expo-secure-store";

const KEY = "onemogo_token";

export async function setToken(token: string) {
  await SecureStore.setItemAsync(KEY, token);
}

export async function getToken() {
  return SecureStore.getItemAsync(KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(KEY);
}
