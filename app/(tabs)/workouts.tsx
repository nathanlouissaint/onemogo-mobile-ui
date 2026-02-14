import React from "react";
import { Text, StyleSheet } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { theme } from "../../src/constants/theme";

export default function WorkoutsScreen() {
  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Workouts</Text>
        <Text style={styles.sub}>Coming next.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: 20, fontWeight: "800" },
  sub: { color: theme.colors.textMuted, marginTop: 8 },
});
