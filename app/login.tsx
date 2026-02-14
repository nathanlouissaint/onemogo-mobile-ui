import React, { useState } from "react";
import { Text, StyleSheet, TextInput, View, ActivityIndicator } from "react-native";
import { Screen } from "../src/components/Screen";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { theme } from "../src/constants/theme";
import { router } from "expo-router";
import { login } from "../src/lib/api"; // adjust if path differs

export default function LoginScreen() {
  const [email, setEmail] = useState("test1@example.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);

    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
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
            placeholder="Password"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            style={styles.input}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            label={loading ? "Signing in..." : "Continue"}
            onPress={handleLogin}
            disabled={loading}
          />
          {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
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
  error: {
    color: "#ff6b6b",
    marginTop: 12,
  },
});
