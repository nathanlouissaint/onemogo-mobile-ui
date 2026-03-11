import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
  TextStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { theme } from "../constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PrimaryButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: PrimaryButtonVariant;
};

function getVariantStyles(variant: PrimaryButtonVariant) {
  switch (variant) {
    case "secondary":
      return {
        button: styles.btnSecondary,
        text: styles.textSecondary,
        spinner: theme.colors.text,
      };
    case "ghost":
      return {
        button: styles.btnGhost,
        text: styles.textGhost,
        spinner: theme.colors.text,
      };
    case "danger":
      return {
        button: styles.btnDanger,
        text: styles.textPrimary,
        spinner: "#FFFFFF",
      };
    case "primary":
    default:
      return {
        button: styles.btnPrimary,
        text: styles.textPrimary,
        spinner: "#FFFFFF",
      };
  }
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  style,
  textStyle,
  variant = "primary",
}: Props) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const variantStyles = getVariantStyles(variant);

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => {
        if (isDisabled) return;
        scale.value = withSpring(0.985, {
          damping: 20,
          stiffness: 260,
          mass: 0.7,
        });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, {
          damping: 20,
          stiffness: 260,
          mass: 0.7,
        });
      }}
      style={({ pressed }) => [
        styles.base,
        variantStyles.button,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
        animatedStyle,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={variantStyles.spinner} />
        ) : (
          <Text
            numberOfLines={1}
            style={[styles.textBase, variantStyles.text, textStyle]}
          >
            {label}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },

  content: {
    minHeight: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  btnPrimary: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },

  btnSecondary: {
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.border,
  },

  btnGhost: {
    backgroundColor: "transparent",
    borderColor: theme.colors.border,
  },

  btnDanger: {
    backgroundColor: "#b91c1c",
    borderColor: "#b91c1c",
  },

  textBase: {
    fontSize: theme.font.size.md,
    fontWeight: "800",
    textAlign: "center",
  },

  textPrimary: {
    color: "#FFFFFF",
  },

  textSecondary: {
    color: theme.colors.text,
  },

  textGhost: {
    color: theme.colors.text,
  },

  pressed: {
    opacity: 0.96,
  },

  disabled: {
    opacity: 0.5,
  },
});
