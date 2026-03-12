import React from "react";
import {
  Text,
  StyleSheet,
  TextProps,
  StyleProp,
  TextStyle,
} from "react-native";
import { theme } from "../constants/theme";

type Variant =
  | "title"
  | "section"
  | "kicker"
  | "body"
  | "meta"
  | "label"
  | "danger";

type Props = TextProps & {
  variant?: Variant;
  style?: StyleProp<TextStyle>;
};

export function AppText({
  variant = "body",
  style,
  ...props
}: Props) {
  return <Text {...props} style={[styles.base, styles[variant], style]} />;
}

const styles = StyleSheet.create({
  base: {
    color: theme.colors.text,
  },

  title: {
    fontSize: theme.font.size.xxl,
    fontWeight: "900",
    color: theme.colors.text,
  },

  section: {
    fontSize: theme.font.size.sm,
    fontWeight: "900",
    color: theme.colors.textFaint,
  },

  kicker: {
    fontSize: theme.font.size.sm,
    fontWeight: "800",
    color: theme.colors.textFaint,
  },

  body: {
    fontSize: theme.font.size.md,
    fontWeight: "700",
    color: theme.colors.text,
  },

  meta: {
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },

  label: {
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },

  danger: {
    fontSize: theme.font.size.sm,
    fontWeight: "800",
    color: theme.colors.danger,
  },
});