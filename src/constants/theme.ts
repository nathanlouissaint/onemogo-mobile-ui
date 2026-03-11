import { Platform } from "react-native";

export const theme = {
  colors: {
    bg: "#0B0C0F",
    surface: "#12141A",
    surface2: "#171A22",

    border: "rgba(255,255,255,0.08)",
    borderSubtle: "rgba(255,255,255,0.05)",

    text: "rgba(255,255,255,0.92)",
    textMuted: "rgba(255,255,255,0.62)",
    textFaint: "rgba(255,255,255,0.40)",

    accent: "#0A84FF",
    accentSoft: "rgba(10,132,255,0.14)",
    accentBorder: "rgba(10,132,255,0.25)",

    success: "#30D158",
    danger: "#FF453A",

    white: "#FFFFFF",
    black: "#000000",
    overlay: "rgba(0,0,0,0.35)",
  },

  radius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 26,
    pill: 999,
  },

  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28,
  },

  layout: {
    screenMaxWidth: 560,
    screenPaddingHorizontal: 16,
    screenPaddingTop: 12,
    screenPaddingBottom: 20,

    cardPadding: 16,
    sectionGap: 20,

    tabBarPaddingTop: 10,
    tabBarPaddingBottom: 22,
  },

  font: {
    family: {
      regular: Platform.OS === "ios" ? "System" : "System",
      semibold: Platform.OS === "ios" ? "System" : "System",
      bold: Platform.OS === "ios" ? "System" : "System",
    },

    size: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 20,
      xl: 28,
      xxl: 34,
    },

    weight: {
      regular: "400" as const,
      semibold: "600" as const,
      bold: "700" as const,
      heavy: "800" as const,
      black: "900" as const,
    },

    lineHeight: {
      sm: 18,
      md: 22,
      lg: 28,
      xl: 36,
    },
  },

  components: {
    buttonHeight: 52,
    inputHeight: 48,
    cardRadius: 20,
    tabBarHeight: 88,
    progressHeight: 10,
    badgeHeight: 32,
  },

  shadows: {
    card:
      Platform.OS === "ios"
        ? {
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
          }
        : {
            elevation: 6,
          },
  },
} as const;