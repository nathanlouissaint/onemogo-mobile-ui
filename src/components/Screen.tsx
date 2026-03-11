import { ReactNode } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  StyleProp,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../constants/theme";

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = false,
  padded = true,
  contentStyle,
}: ScreenProps) {
  const content = (
    <View
      style={[
        styles.content,
        padded && styles.paddedContent,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />

        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },

  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    position: "relative",
  },

  scrollContent: {
    flexGrow: 1,
  },

  content: {
    flex: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },

  paddedContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },

  bgGlowTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(10,132,255,0.10)",
  },

  bgGlowBottom: {
    position: "absolute",
    bottom: -140,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 280,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
});