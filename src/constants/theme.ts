import { Platform } from "react-native";

export const theme = {
  colors: {
    bg: "#0B0C0F",
    surface: "#12141A",
    surface2: "#171A22",
    border: "rgba(255,255,255,0.08)",
    text: "rgba(255,255,255,0.92)",
    textMuted: "rgba(255,255,255,0.62)",
    textFaint: "rgba(255,255,255,0.40)",
    accent: "#0A84FF", // Apple-like blue
    success: "#30D158",
    danger: "#FF453A",
  },
  radius: { sm: 12, md: 16, lg: 20, xl: 26 },
  spacing: { xs: 8, sm: 12, md: 16, lg: 20, xl: 28 },
  font: {
    family: Platform.select({
      ios: { regular: "System", semibold: "System", bold: "System" },
      default: { regular: "System", semibold: "System", bold: "System" },
    }),
    size: { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, xxl: 34 },
  },
} as const;
