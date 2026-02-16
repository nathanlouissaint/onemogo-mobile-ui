// app/login.tsx
import React, { useMemo, useState } from "react";
import {
  Text,
  StyleSheet,
  TextInput,
  View,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { router } from "expo-router";

import { Screen } from "../src/components/Screen";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { theme } from "../src/constants/theme";
import { login } from "../src/lib/api";
import { useSession } from "../src/session/SessionContext";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function LoginScreen() {
  const { signIn } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const canSubmit = useMemo(() => {
    return isValidEmail(normalizedEmail) && password.trim().length > 0 && !loading;
  }, [normalizedEmail, password, loading]);

  const handleLogin = async () => {
    setError(null);

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    setLoading(true);
    try {
      const user = await login(normalizedEmail, password.trim());
      signIn(user);
      // Root guard handles navigation
    } catch (e: any) {
      const msg = (e?.message ?? "Login failed").toString();
      if (msg.toLowerCase().includes("not authenticated")) {
        setError("Incorrect email or password.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>ONEMOGO</Text>
        <Text style={styles.sub}>Sign in to continue.</Text>

        <View style={{ gap: 12 }}>
          <TextInput
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (error) setError(null);
            }}
            placeholder="Email"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            editable={!loading}
          />

          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (error) setError(null);
              }}
              placeholder="Password"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry={!showPassword}
              style={[styles.input, { flex: 1 }]}
              editable={!loading}
            />

            <Pressable
              onPress={() => setShowPassword((p) => !p)}
              disabled={loading}
              style={({ pressed }) => [styles.toggleBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.toggleBtnText}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            label={loading ? "Signing in..." : "Continue"}
            onPress={handleLogin}
            disabled={!canSubmit}
          />

          {loading && <ActivityIndicator style={{ marginTop: 12 }} />}

          <View style={{ height: 12 }} />

          <PrimaryButton
            label="Create account"
            onPress={() => router.replace("/register")}
            disabled={loading}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: 28, fontWeight: "900" },
  sub: { color: theme.colors.textMuted, marginTop: 8, marginBottom: 16 },

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
  },

  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  toggleBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },

  toggleBtnText: {
    color: theme.colors.textMuted,
    fontWeight: "900",
    fontSize: 12,
  },

  error: {
    color: "#ff6b6b",
    marginTop: 12,
    fontWeight: "700",
  },
});
