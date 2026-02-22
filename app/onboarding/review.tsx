// app/onboarding/review.tsx
import React from "react";
import { Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { theme } from "../../src/constants/theme";

export default function ReviewScreen() {
  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 20, fontWeight: "800", color: theme.colors.text }}>
          Review
        </Text>
        <View style={{ height: 8 }} />
        <Text style={{ color: theme.colors.textMuted }}>
          This screen is coming next. It must have a default export so Expo Router can load it.
        </Text>
      </Card>
    </Screen>
  );
}