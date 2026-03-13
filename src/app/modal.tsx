import React from "react";
import { Text, StyleSheet } from "react-native";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { theme } from "../constants/theme";

export default function ModalScreen() {
  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Modal</Text>
        <Text style={styles.sub}>This is a placeholder modal.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: 20, fontWeight: "800" },
  sub: { color: theme.colors.textMuted, marginTop: 8 },
});