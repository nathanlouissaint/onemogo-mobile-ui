// src/components/BackToLogin.tsx
import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { theme } from "../constants/theme";

export function BackToLogin({ label = "Back to login" }: { label?: string }) {
  return (
    <Pressable
      onPress={() => router.replace("/login")}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
      hitSlop={10}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignSelf: "center", paddingVertical: 6, paddingHorizontal: 10 },
  text: {
    color: theme.colors.textMuted,
    textDecorationLine: "underline",
    fontSize: 13,
    fontWeight: "700",
  },
});