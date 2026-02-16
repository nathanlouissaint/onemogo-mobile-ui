// app/_layout.tsx
import React, { useEffect, useState } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";

import { useColorScheme } from "../src/hooks/use-color-scheme";
import { SessionProvider } from "../src/session/SessionContext";
import { setOnUnauthorized } from "../src/lib/api";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  // Initial token check
  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!mounted) return;

      setHasToken(!!token);
      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Keep hasToken in sync when navigation changes (covers login/logout flows)
  useEffect(() => {
    if (!ready) return;

    let mounted = true;
    (async () => {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!mounted) return;
      setHasToken(!!token);
    })();

    return () => {
      mounted = false;
    };
  }, [ready, pathname]);

  // Centralized 401/session-expired handler from api.ts
  useEffect(() => {
    setOnUnauthorized(() => {
      setHasToken(false);
      router.replace("/login");
    });

    return () => setOnUnauthorized(null);
  }, [router]);

  // Routing guard
  useEffect(() => {
    if (!ready) return;

    const isPublic = pathname === "/login" || pathname === "/register";
    const inTabs = pathname.startsWith("/(tabs)");

    if (!hasToken && !isPublic) {
      router.replace("/login");
      return;
    }

    if (hasToken && isPublic) {
      router.replace("/(tabs)");
      return;
    }

    if (!hasToken && (pathname === "/" || pathname === "")) {
      router.replace("/login");
      return;
    }

    if (hasToken && (pathname === "/" || pathname === "")) {
      router.replace("/(tabs)");
      return;
    }

    if (hasToken && inTabs) return;
  }, [ready, hasToken, pathname, router]);

  if (!ready) return null;

  return (
    <SessionProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SessionProvider>
  );
}
