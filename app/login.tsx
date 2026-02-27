// app/login.tsx
import React, { useMemo, useState } from "react";
import {
  Text,
  StyleSheet,
  TextInput,
  View,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";

import { Screen } from "../src/components/Screen";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { theme } from "../src/constants/theme";
import { useSession } from "../src/session/SessionContext";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function LoginScreen() {
  const { login } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const canSubmit = useMemo(() => {
    return (
      isValidEmail(normalizedEmail) &&
      password.trim().length > 0 &&
      !loading
    );
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
      await login(normalizedEmail, password.trim());
    } catch (e: any) {
      const msg = (e?.message ?? "Login failed").toString();
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.cardWrapper}>
          <Card>
            <Text style={styles.title}>ONEMOGO</Text>
            <Text style={styles.sub}>Sign in to continue.</Text>

            <View style={styles.form}>
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
                  style={[styles.input, styles.passwordInput]}
                  editable={!loading}
                />

                <Pressable
                  onPress={() => setShowPassword((p) => !p)}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.toggleBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  hitSlop={10}
                >
                  <Text style={styles.toggleBtnText}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.actions}>
              <PrimaryButton
                label={loading ? "Signing in..." : "Continue"}
                onPress={handleLogin}
                disabled={!canSubmit}
              />

              {loading && <ActivityIndicator style={{ marginTop: 12 }} />}

              <View style={{ height: 12 }} />

              <PrimaryButton
                label="Create account"
                onPress={() => router.push("/register")}
                disabled={loading}
              />
            </View>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  cardWrapper: {
    width: "100%",
    maxWidth: 420,
    transform: [{ translateY: -40 }], // 👈 Moves card slightly up
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 16,
  },
  form: {
    gap: 12,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  passwordInput: {
    flex: 1,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  toggleBtnText: {
    color: theme.colors.text,
    fontWeight: "600",
  },
  error: {
    marginTop: 12,
    color: theme.colors.danger ?? "#ff3b30",
    fontSize: 13,
  },
  actions: {
    marginTop: 16,
  },
});