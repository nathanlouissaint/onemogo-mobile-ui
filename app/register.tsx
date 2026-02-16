// app/register.tsx
import React, { useState } from "react";
import { Text, StyleSheet, TextInput, View, ActivityIndicator } from "react-native";
import { router } from "expo-router";

import { Screen } from "../src/components/Screen";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { theme } from "../src/constants/theme";
import { register, ApiError } from "../src/lib/api";

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (username.trim() && username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    setLoading(true);

    try {
      await register({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        username: username.trim() ? username.trim().replace(/\s/g, "") : undefined,
      });

      router.replace("/(tabs)");
    } catch (e: any) {
      if (e instanceof ApiError) {
        setError(e.message || "Registration failed");
      } else {
        setError(e?.message ?? "Registration failed");
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
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="words"
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="words"
                style={[styles.input, { flex: 1 }]}
              />
            </View>

            <TextInput
              value={username}
              onChangeText={(v) => setUsername(v.replace(/\s/g, ""))}
              placeholder="Username (optional)"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password (8+ chars)"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              style={styles.input}
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
  error: {
    color: "#ff6b6b",
    marginTop: 12,
  },
})
