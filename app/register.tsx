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
import { register, ApiError } from "../src/lib/api";
import { useSession } from "../src/session/SessionContext";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function RegisterScreen() {
  const { signIn } = useSession();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedUsername = useMemo(() => username.trim().replace(/\s/g, ""), [username]);

  const canSubmit = useMemo(() => {
    const pwOk = password.trim().length >= 8;
    const emailOk = isValidEmail(normalizedEmail);
    const usernameOk = !normalizedUsername || normalizedUsername.length >= 3;
    return emailOk && pwOk && usernameOk && !loading;
  }, [normalizedEmail, password, normalizedUsername, loading]);

  const handleRegister = async () => {
    setError(null);

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (normalizedUsername && normalizedUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    setLoading(true);

    try {
      const user = await register({
        email: normalizedEmail,
        password: password.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        username: normalizedUsername || undefined,
      });

      signIn(user);
      // Root layout guard will redirect to /(tabs)
    } catch (e: any) {
      const msg =
        e instanceof ApiError ? (e.message || "Registration failed") : (e?.message ?? "Registration failed");

      const lower = msg.toLowerCase();

      // basic mapping based on common backend phrasing
      if (lower.includes("email") && (lower.includes("exists") || lower.includes("taken") || lower.includes("duplicate"))) {
        setError("That email is already in use. Try signing in.");
      } else if (lower.includes("username") && (lower.includes("exists") || lower.includes("taken") || lower.includes("duplicate"))) {
        setError("That username is unavailable. Try another.");
      } else if (lower.includes("password")) {
        setError("Password doesn't meet requirements.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.centerWrap}>
        <Card>
          <Text style={styles.title}>ONEMOGO</Text>
          <Text style={styles.sub}>Create your account.</Text>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TextInput
                value={firstName}
                onChangeText={(v) => {
                  setFirstName(v);
                  if (error) setError(null);
                }}
                placeholder="First name"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="words"
                style={[styles.input, { flex: 1 }]}
                editable={!loading}
              />
              <TextInput
                value={lastName}
                onChangeText={(v) => {
                  setLastName(v);
                  if (error) setError(null);
                }}
                placeholder="Last name"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="words"
                style={[styles.input, { flex: 1 }]}
                editable={!loading}
              />
            </View>

            <TextInput
              value={username}
              onChangeText={(v) => {
                setUsername(v.replace(/\s/g, ""));
                if (error) setError(null);
              }}
              placeholder="Username (optional)"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              style={styles.input}
              editable={!loading}
            />

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
                placeholder="Password (8+ chars)"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={!showPassword}
                style={[styles.input, styles.passwordInput]}
                editable={!loading}
              />

              <Pressable
                onPress={() => setShowPassword((p) => !p)}
                disabled={loading}
                hitSlop={10}
                style={({ pressed }) => [styles.showBtn, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.showBtnText}>{showPassword ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={{ marginTop: 16 }}>
            <PrimaryButton
              label={loading ? "Creating..." : "Create account"}
              onPress={handleRegister}
              disabled={!canSubmit}
            />

            {loading && <ActivityIndicator style={{ marginTop: 12 }} />}

            <View style={{ height: 12 }} />

            <PrimaryButton
              label="Back to sign in"
              onPress={() => router.replace("/login")}
              disabled={loading}
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 24,
  },

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
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 68,
  },
  showBtn: {
    position: "absolute",
    right: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  showBtnText: {
    color: theme.colors.textMuted,
    fontWeight: "800",
    fontSize: 12,
  },

  error: {
    color: "#ff6b6b",
    marginTop: 12,
    fontWeight: "700",
  },
});
