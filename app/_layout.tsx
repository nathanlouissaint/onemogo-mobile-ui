// app/_layout.tsx
import React, { useEffect } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useColorScheme } from "../src/hooks/use-color-scheme";
import { SessionProvider, useSession } from "../src/session/SessionContext";
import { setOnUnauthorized } from "../src/lib/api";

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();

  const { user, loading, signOut } = useSession();

  // Centralized 401/session-expired handler from api.ts
  useEffect(() => {
    setOnUnauthorized(() => {
      // Clear session state. Routing guard will redirect to /login.
      signOut().catch(() => {});
    });

    return () => setOnUnauthorized(null);
  }, [signOut]);

  // Routing guard (single source of navigation truth)
  useEffect(() => {
    if (loading) return;

    const isPublic = pathname === "/login" || pathname === "/register";
    const isRoot = pathname === "/" || pathname === "";
    const authed = !!user;

    if (!authed && !isPublic) {
      router.replace("/login");
      return;
    }

    if (authed && isPublic) {
      router.replace("/(tabs)");
      return;
    }

    if (!authed && isRoot) {
      router.replace("/login");
      return;
    }

    if (authed && isRoot) {
      router.replace("/(tabs)");
      return;
    }
  }, [loading, user, pathname, router]);

  if (loading) return null;

  return (
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
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootLayoutInner />
    </SessionProvider>
  );
}
