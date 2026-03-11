import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { theme } from "../constants/theme";

type CardVariant = "default" | "subtle" | "elevated";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
};

export function Card({
  children,
  style,
  variant = "default",
}: Props) {
  const variantStyle =
    variant === "subtle"
      ? styles.subtle
      : variant === "elevated"
      ? styles.elevated
      : styles.default;

  return <View style={[styles.base, variantStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.components.cardRadius,
    padding: theme.layout.cardPadding,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },

  default: {},

  subtle: {
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.borderSubtle,
  },

  elevated: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
});