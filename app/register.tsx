// app/register.tsx
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
import { useSession } from "../src/session/SessionContext";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function RegisterScreen() {
  const { register } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const handleRegister = async () => {
    setError(null);

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email.");
      return;
    }

    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await register({
        email: normalizedEmail,
        password: password.trim(),
      });
      // Session guard will handle routing
    } catch (e: any) {
      console.log("[register] error:", e);
      setError((e?.message ?? "Registration failed").toString());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.sub}>
          Set up your account to start tracking.
        </Text>

        <View style={{ gap: 12, marginTop: 12 }}>
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
              placeholder="Password (min 8)"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry={!showPassword}
              style={[styles.input, { flex: 1 }]}
              editable={!loading}
            />

            <Pressable
              onPress={() => setShowPassword((p) => !p)}
              disabled={loading}
              style={({ pressed }) => [
                styles.toggleBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.toggleBtnText}>
                {showPassword ? "Hide" : "Show"}
              </Text>
            </Pressable>
          </View>

          <TextInput
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              if (error) setError(null);
            }}
            placeholder="Confirm password"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry={!showPassword}
            style={styles.input}
            editable={!loading}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            label={loading ? "Creating..." : "Create account"}
            onPress={handleRegister}
            disabled={loading}
          />

          {loading && <ActivityIndicator style={{ marginTop: 12 }} />}

          <View style={{ height: 12 }} />

          <Pressable onPress={() => router.replace("/login")}>
            <Text style={styles.link}>
              Already have an account? Sign in
            </Text>
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
  },
  sub: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    padding: 14,
    borderRadius: 14,
    fontSize: 16,
  },
  passwordRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  toggleBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  toggleBtnText: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  error: {
    marginTop: 10,
    color: theme.colors.danger ?? "red",
    textAlign: "center",
  },
  link: {
    color: theme.colors.textMuted,
    textAlign: "center",
    textDecorationLine: "underline",
  },
});